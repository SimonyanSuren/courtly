# Performance of the booking queries

Bookings are never deleted, so the table keeps every booking ever made, cancelled ones included.
Two read queries ask about a single day of that history, and they run on every request of two
routes:

- **Availability:** `BookingsRepository.confirmedTimes(courtId, day)`, the court's confirmed
  bookings that overlap a calendar day. It runs on every `GET /api/courts/:id/availability`.
- **The admin day view:** `BookingsRepository.listStartingIn(day)`, every booking that starts on a
  day, with its court and its user, ordered by court name, start and id. It runs on every
  `GET /api/admin/bookings`.

A day's answer stays the same size as the history grows; the question is whether the work does
too. This document measures both queries at 10,000, 100,000 and 1,000,000 bookings. The other
queries read one row by its primary key, read one user's bookings through
`bookings_user_id_index`, or write one row.

## Running it

`npm run perf -w apps/api` needs Docker and takes about 3 minutes, most of it filling the largest
size. Like `npm test`, it starts PostgreSQL 18.6 with Testcontainers and applies the migrations;
it never touches the Compose database or its demo data. For each size it replaces the bookings
with synthetic ones, times both queries and both routes, and prints the statements, their plans
and a summary table. It fails if a query's index stops answering the query's whole condition, if
the day view does not return the whole day, or if availability returns other bookings than a
plain comparison of the times selects, on any court and day it measures.

The code lives in `apps/api/perf/`. `npm test` does not run it: its file ends in `.perf.ts`,
which the tests' Jest configuration never matches. The API image does not contain it: the
image's allowlist (`apps/api/Dockerfile.dockerignore`) lets in only `src/` and `migrations/`.

## Method

### Data

- One facility: 10 courts, each open from 08:00 to 22:00, and 1,000 customers.
- A court's day is seven 2-hour blocks. Each block holds one of ten patterns, each used for a
  tenth of the blocks: one 2-hour booking (three patterns); two 1-hour bookings (three); one
  1-hour booking and a free hour; a cancelled hour, then both hours booked by someone else; a
  cancelled 2-hour booking; nothing. The patterns go round the courts and the days, so every day
  holds the same mix: 91 bookings, 14 of them cancelled (15%), with 75% of the court hours booked.
- The bookings fill whole days, counted back from 31 December 2026; only the oldest day is
  partly filled. Every time is a whole local hour in Europe/Lisbon, so every row satisfies the
  table's constraints, the exclusion constraint included. A cancelled booking may overlap a
  confirmed one, as the constraint allows.
- Each size is one `INSERT ... SELECT` over `generate_series`, in order of start, roughly the
  order in which a facility's bookings arrive. `VACUUM (ANALYZE)` then does what autovacuum would
  do to a table this size: planner statistics and the visibility map.

At 91 bookings a day, this facility records about 33,000 bookings a year (91 × 365 = 33,215).

| Bookings  |   Days | Table and indexes | History of this facility                         |
| --------- | -----: | ----------------: | ------------------------------------------------ |
| 10,000    |    110 |           2.9 MiB | about 4 months                                   |
| 100,000   |  1,099 |          28.1 MiB | about 3 years                                    |
| 1,000,000 | 10,990 |         280.8 MiB | about 30 years: more than one facility will hold |

The largest size is a stress test: it shows how each query's cost grows, not a load the facility
will reach.

### Measurement

- **Queries:** the repository's own methods, called through Drizzle over a pool made by the API's
  `createPool`, with the API's settings. Drizzle's logger records the statement each call sends,
  and that statement runs under `EXPLAIN (ANALYZE, BUFFERS)` with the same parameters: the plans
  below are of exactly what the API sends, not of SQL typed by hand.
- **Routes:** the whole app (`createTestApp()`) listening on a local port, called with `fetch`
  and a session cookie, as a browser calls it. Each request also checks the session; availability
  also reads the court, and the day view builds the JSON for 91 bookings.
- **Runs:** for each size, each query and each route gets 100 untimed calls, which fill
  PostgreSQL's cache and let Node compile the code, then 200 timed calls, one after another. The
  calls go round 3 courts (Court 01, 05 and 10) and 5 days (10, 30, 50, 70 and 90 days before the
  last), which every size holds in full. The tables give the median and the 95th percentile
  (nearest rank) in milliseconds, as the caller sees them: they include the round trip to
  PostgreSQL and turning rows into objects. The time PostgreSQL itself spends is the plans'
  `Execution Time`.
- **Machine**, as the run reports it: Intel Core i5-1135G7 (4 cores, 8 threads) with 7.4 GiB of
  memory, Linux 6.17, Node 26.13.0. PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) runs in Docker on the
  same machine, with the image's default settings: `shared_buffers` 128 MB, `work_mem` 4 MB,
  `effective_cache_size` 4 GB, `random_page_cost` 4, `jit` on, 2 parallel workers per query. The
  machine is a laptop running other programs: a single number moves by a millisecond or so from
  run to run, the trends do not.

## Results

### Availability, before and after its rewrite

The first run measured the query as it was:
`court_id = $1 and status = 'confirmed' and starts_at < $end and ends_at > $start`. The second
measured it rewritten as the exclusion constraint's own condition:
`court_id = $1 and status = 'confirmed' and tstzrange(starts_at, ends_at, '[)') && tstzrange($start, $end, '[)')`.
Both select the same bookings: two ranges that exclude their end overlap exactly when each starts
before the other ends.

| Bookings  | Before: query | Before: route | After: query | After: route |
| --------- | ------------: | ------------: | -----------: | -----------: |
| 10,000    |   1.60 / 1.99 |   5.02 / 6.10 |  1.04 / 1.46 |  4.27 / 5.24 |
| 100,000   |   4.32 / 4.96 |   7.72 / 9.38 |  0.90 / 1.40 |  4.23 / 6.00 |
| 1,000,000 | 51.70 / 65.77 | 56.37 / 72.83 |  1.04 / 1.40 |  4.81 / 7.94 |

What one execution read, from the plans (first court, 21 December 2026, 8 bookings found):

| Bookings  | Before: rows read | Before: buffers | Before: execution | After: rows read | After: buffers | After: execution |
| --------- | ----------------: | --------------: | ----------------: | ---------------: | -------------: | ---------------: |
| 10,000    |               846 |             170 |          0.464 ms |                8 |              5 |         0.060 ms |
| 100,000   |             8,465 |           1,685 |          2.920 ms |                8 |              4 |         0.070 ms |
| 1,000,000 |            84,618 |          16,823 |        113.935 ms |                8 |              6 |         0.067 ms |

Before, the work grew with the court's whole history. At a million bookings, the court's 84,618
confirmed bookings lie on 15,385 pages of the table, and 12,759 of the pages read were not in
PostgreSQL's 128 MB of shared buffers, which the table and its indexes (281 MiB) no longer fit.
After, the query reads the same 8 rows at every size.

### The day view

| Bookings  | Query       | Route        | Execution in PostgreSQL |
| --------- | ----------- | ------------ | ----------------------: |
| 10,000    | 3.88 / 4.41 | 7.60 / 12.08 |                0.697 ms |
| 100,000   | 3.88 / 4.95 | 7.51 / 10.45 |                0.663 ms |
| 1,000,000 | 4.22 / 6.05 | 8.52 / 12.95 |                0.615 ms |

The query did not change; the first run's numbers were within the same range (3.9 to 6.4 ms
median). PostgreSQL spends 0.6 to 0.7 ms on it at every size. The rest of the 4 ms is the round
trip and turning 91 rows of 14 columns into objects, timestamps included.

## Plans

At 1,000,000 bookings, trimmed to the nodes and lines that matter. Parameters show as the
values PostgreSQL planned with.

Availability before: the GiST index can match only `court_id`, so the scan returns every
confirmed booking of the court, and the time comparison runs row by row on the table.

```text
Bitmap Heap Scan on bookings  (actual time=113.851..113.901 rows=8.00 loops=1)
  Recheck Cond: ((court_id = '…'::uuid) AND (status = 'confirmed'::booking_status))
  Filter: ((starts_at < '2026-12-22 00:00:00+00') AND (ends_at > '2026-12-21 00:00:00+00'))
  Rows Removed by Filter: 84610
  Heap Blocks: exact=15385
  Buffers: shared hit=4064 read=12759
  ->  Bitmap Index Scan on bookings_no_overlap  (actual time=12.137..12.137 rows=84618.00 loops=1)
        Index Cond: (court_id = '…'::uuid)
Execution Time: 113.935 ms
```

Availability after: the index answers the court and the time together. The partial index's
condition (`status = 'confirmed'`) is the query's own, so no row is filtered out.

```text
Bitmap Heap Scan on bookings  (actual time=0.052..0.054 rows=8.00 loops=1)
  Heap Blocks: exact=2
  Buffers: shared hit=6
  ->  Bitmap Index Scan on bookings_no_overlap  (actual time=0.039..0.039 rows=8.00 loops=1)
        Index Cond: ((court_id = '…'::uuid) AND (tstzrange(starts_at, ends_at, '[)'::text) && '["2026-12-21 00:00:00+00","2026-12-22 00:00:00+00")'::tstzrange))
Execution Time: 0.067 ms
```

The day view: a range scan of `bookings_starts_at_index` over the day's 91 rows, the 10 courts by
primary key (each looked up once, then remembered), the users through a hash of the whole users
table, and a sort of 91 rows in memory.

```text
Sort  (actual time=0.578..0.584 rows=91.00 loops=1)
  Sort Key: courts.name, bookings.starts_at, bookings.id
  Sort Method: quicksort  Memory: 39kB
  ->  Hash Join  (actual time=0.358..0.462 rows=91.00 loops=1)
        Hash Cond: (bookings.user_id = users.id)
        ->  Nested Loop  (actual time=0.016..0.096 rows=91.00 loops=1)
              ->  Index Scan using bookings_starts_at_index on bookings  (actual time=0.008..0.025 rows=91.00 loops=1)
                    Index Cond: ((starts_at >= '2026-12-21 00:00:00+00') AND (starts_at < '2026-12-22 00:00:00+00'))
                    Buffers: shared hit=5
              ->  Memoize  (actual time=0.000..0.000 rows=1.00 loops=91)
                    Hits: 81  Misses: 10
                    ->  Index Scan using courts_pkey on courts  (actual time=0.001..0.001 rows=1.00 loops=10)
        ->  Hash  (actual time=0.338..0.338 rows=1002.00 loops=1)
              ->  Seq Scan on users  (actual time=0.005..0.107 rows=1002.00 loops=1)
                    Buffers: shared hit=14
Execution Time: 0.615 ms
```

## Conclusion

- **Availability is served by `bookings_no_overlap`**, the GiST index behind the exclusion
  constraint, on the court and the time together. Comparing `starts_at` and `ends_at` separately,
  the query could use that index for the court alone and read every confirmed booking the court
  ever had: 51.7 ms at a million bookings, and growing in step with the history. Written as the
  constraint's own expression, it reads the day's bookings directly: about 1 ms for the caller and
  0.07 ms in PostgreSQL at every size. The tests pass unchanged.
- **The day view is served by `bookings_starts_at_index`**, a range scan over one day. Its time
  does not change with the size of the history. The hash of the users table grows with the number
  of users, not of bookings: at 1,000 users it reads 14 pages.
- **No new index is needed.** Both queries read only the day's rows at every size, through
  indexes that already exist: one for the no-overlap rule, one for the day view.
- The planner's estimate for the range condition is about 1% of the court's confirmed bookings
  (833 rows expected against 8 found at a million). The plan is right anyway: every other plan it
  could choose reads more.
