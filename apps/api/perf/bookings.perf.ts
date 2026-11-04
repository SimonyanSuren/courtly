import os from 'node:os';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { type Pool } from 'pg';

import { BookingsRepository } from '../src/modules/bookings/bookings.repository';
import { calendarDay } from '../src/modules/bookings/domain/slots';
import { courts } from '../src/modules/courts/courts.schema';
import { FACILITY_TIME_ZONE } from '../src/modules/courts/domain/opening-hours';
import { Role } from '../src/modules/users/domain/role';
import { DATABASE, type Database } from '../src/platform/database/database';
import { databaseConfig } from '../src/platform/database/database.config';
import { createPool } from '../src/platform/database/pool';
import { createTestApp } from '../test/create-test-app';
import { createUser, logIn } from '../test/users';
import { explainAnalyze, QueryRecorder, type SentQuery, time, type Timing } from './measure';
import {
  BOOKINGS_PER_DAY,
  COURT_COUNT,
  insertCourtsAndCustomers,
  LAST_DAY,
  replaceBookings,
} from './synthetic-data';

const SIZES = [10_000, 100_000, 1_000_000];

/** Timed calls of each query or route per size, after untimed ones that warm the caches. */
const RUNS = { runs: 200, warmUp: 100 };

/** The courts and days the calls go round. Every size has a full day of bookings on each day. */
const COURT_NAMES = ['Court 01', 'Court 05', 'Court 10'];
const DAYS = [10, 30, 50, 70, 90].map((days) => LAST_DAY.subtract({ days }));

const print = (text = ''): void => {
  process.stdout.write(`${text}\n`);
};

const ms = (value: number): string => value.toFixed(2);
const mib = (bytes: number): string => (bytes / 2 ** 20).toFixed(1);
const count = (value: number): string => value.toLocaleString('en-GB');
const medianAndP95 = ({ medianMs, p95Ms }: Timing): string =>
  `median ${ms(medianMs)} ms, p95 ${ms(p95Ms)} ms`;

/** What one query did: its timing, the statement the repository sent and that statement's plan. */
interface Measured {
  timing: Timing;
  rows: number;
  query: SentQuery;
  plan: string;
}

function report(name: string, { timing, rows, query, plan }: Measured): void {
  print();
  print(`### ${name}: ${medianAndP95(timing)}`);
  print();
  print(`SQL: ${query.sql}`);
  print(`Parameters: ${JSON.stringify(query.params)}`);
  print(`Rows: ${String(rows)}`);
  print();
  print(plan);
}

/**
 * The Index Cond of the plan node that scans `index`: the part of the WHERE clause the index
 * itself answers. Whatever is left is checked row by row, on every row the index returns.
 */
function indexCondition(plan: string, index: string): string | undefined {
  const lines = plan.split('\n');
  const scan = lines.findIndex((line) => line.includes(` ${index} `));

  return scan === -1 ? undefined : lines[scan + 1]?.trim();
}

interface Result {
  size: number;
  days: number;
  megabytes: string;
  confirmedTimes: Timing;
  listStartingIn: Timing;
  availabilityRoute: Timing;
  dayViewRoute: Timing;
}

interface Pick {
  courtId: string;
  day: Temporal.PlainDate;
}

describe('booking queries on synthetic data', () => {
  const recorder = new QueryRecorder();
  const results: Result[] = [];
  let app: NestExpressApplication;
  let url: string;
  let pool: Pool;
  let loaderPool: Pool;
  let loader: Database;
  let repository: BookingsRepository;
  let courtIds: string[];
  let userCookie: string;
  let adminCookie: string;

  /** The court and day of the `index`th call: each pair in turn. */
  const pick = (index: number): Pick => {
    const courtId = courtIds[index % courtIds.length];
    const day = DAYS[Math.floor(index / courtIds.length) % DAYS.length];

    if (courtId === undefined || day === undefined) {
      throw new Error('No court or day to pick.');
    }

    return { courtId, day };
  };

  /**
   * Times `call` over the picked courts and days, then runs EXPLAIN ANALYZE on the statement it
   * sends for the first pair.
   */
  const measure = async (
    call: (picked: Pick) => Promise<readonly unknown[]>,
  ): Promise<Measured> => {
    const timing = await time(RUNS, async (index) => call(pick(index)));
    let rows = 0;
    const query = await recorder.only(async () => {
      const found = await call(pick(0));
      rows = found.length;
    });

    return { timing, rows, query, plan: await explainAnalyze(pool, query) };
  };

  /** A GET to the running app, failing unless it answers 200. */
  const get = async (path: string, cookie: string): Promise<unknown> => {
    const response = await fetch(`${url}/api${path}`, { headers: { cookie } });

    if (response.status !== 200) {
      throw new Error(`GET ${path} answered ${String(response.status)}.`);
    }

    return response.json();
  };

  beforeAll(async () => {
    // The API's own pool, with its settings; Drizzle's logger records each statement it sends.
    const config = databaseConfig();
    pool = createPool(config);
    repository = new BookingsRepository(drizzle({ client: pool, logger: recorder }));
    // Filling a million rows takes longer than the API's statement timeout allows, as a migration
    // may (migrate.ts).
    loaderPool = createPool({ ...config, statementTimeoutMs: 0 });
    loader = drizzle({ client: loaderPool });

    await insertCourtsAndCustomers(loader);
    const picked = await loader
      .select({ id: courts.id })
      .from(courts)
      .where(inArray(courts.name, COURT_NAMES))
      .orderBy(courts.name);
    courtIds = picked.map(({ id }) => id);

    // The whole API, on a port of its own, as a browser would call it.
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    const appDb = app.get<Database>(DATABASE);
    await createUser(appDb, { email: 'perf-user@example.com', role: Role.USER });
    await createUser(appDb, { email: 'perf-admin@example.com', role: Role.ADMIN });
    userCookie = await logIn(app, 'perf-user@example.com');
    adminCookie = await logIn(app, 'perf-admin@example.com');

    const { rows: settings } = await pool.query<{ setting: string }>(
      `select name || '=' || current_setting(name) as setting from unnest(array[
        'shared_buffers', 'work_mem', 'effective_cache_size', 'random_page_cost', 'jit',
        'max_parallel_workers_per_gather']) as name`,
    );
    const { rows: version } = await pool.query<{ version: string }>('select version()');
    const [cpu] = os.cpus();

    print('# Booking queries on synthetic data');
    print();
    print(`PostgreSQL: ${version[0]?.version ?? 'unknown'}`);
    print(`Settings: ${settings.map(({ setting }) => setting).join(', ')}`);
    print(`Node ${process.version} on ${os.type()} ${os.release()} (${os.arch()})`);
    print(
      `CPU: ${cpu?.model ?? 'unknown'}, ${String(os.availableParallelism())} threads; ` +
        `memory: ${mib(os.totalmem())} MiB`,
    );
    print(
      `Data: ${String(COURT_COUNT)} courts, ${String(BOOKINGS_PER_DAY)} bookings a day up to ` +
        `${LAST_DAY.toString()}. Calls go round ${COURT_NAMES.join(', ')} on ` +
        `${DAYS.join(', ')}.`,
    );
    print(
      `Each query and route: ${String(RUNS.warmUp)} untimed calls, then ` +
        `${String(RUNS.runs)} timed ones.`,
    );
  });

  afterAll(async () => {
    print();
    print('## Summary (milliseconds, median / p95)');
    print();
    print(
      '| Bookings | Days | Table and indexes (MiB) | confirmedTimes | listStartingIn | ' +
        'GET availability | GET day view |',
    );
    print('| ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

    for (const result of results) {
      const cells = [
        result.confirmedTimes,
        result.listStartingIn,
        result.availabilityRoute,
        result.dayViewRoute,
      ].map(({ medianMs, p95Ms }) => [ms(medianMs), ms(p95Ms)].join(' / '));
      print(
        `| ${count(result.size)} | ${count(result.days)} | ${result.megabytes} | ` +
          `${cells.join(' | ')} |`,
      );
    }

    await app.close();
    await pool.end();
    await loaderPool.end();
  });

  describe.each(SIZES)('with %d bookings', (size) => {
    const result: Partial<Result> = { size };

    beforeAll(async () => {
      const started = performance.now();
      await replaceBookings(loader, size);
      const seconds = (performance.now() - started) / 1000;

      const { rows: shape } = await pool.query<{
        total: number;
        cancelled: number;
        days: number;
        first: string;
        last: string;
      }>(
        `select count(*)::int as total,
          count(*) filter (where status = 'cancelled')::int as cancelled,
          count(distinct (starts_at at time zone $1)::date)::int as days,
          min((starts_at at time zone $1)::date)::text as first,
          max((starts_at at time zone $1)::date)::text as last
        from bookings`,
        [FACILITY_TIME_ZONE],
      );
      const { rows: relations } = await pool.query<{ name: string; bytes: string }>(
        `select 'bookings' as name, pg_table_size('bookings') as bytes
        union all
        select indexrelid::regclass::text, pg_relation_size(indexrelid)
        from pg_index where indrelid = 'bookings'::regclass
        order by name`,
      );
      const [data] = shape;

      if (data?.total !== size) {
        throw new Error(`Expected ${String(size)} bookings, found ${String(data?.total)}.`);
      }

      result.days = data.days;
      result.megabytes = mib(relations.reduce((sum, { bytes }) => sum + Number(bytes), 0));
      const sizes = relations.map(({ name, bytes }) => [name, mib(Number(bytes))].join(' '));

      print();
      print(`## ${count(size)} bookings`);
      print();
      print(
        `Filled in ${seconds.toFixed(1)} s: ${count(data.cancelled)} of them cancelled, on ` +
          `${count(data.days)} days from ${data.first} to ${data.last}.`,
      );
      print(`Sizes (MiB): ${sizes.join(', ')}.`);
    });

    afterAll(() => {
      results.push(result as Result);
    });

    it('measures availability: BookingsRepository.confirmedTimes', async () => {
      const measured = await measure(async ({ courtId, day }) =>
        repository.confirmedTimes(courtId, calendarDay(day)),
      );

      result.confirmedTimes = measured.timing;
      report('confirmedTimes', measured);
      // The index finds the bookings by court and time together, not every booking of the court.
      expect(indexCondition(measured.plan, 'bookings_no_overlap')).toMatch(
        /^Index Cond: \(\(court_id = .+\) AND \(tstzrange\(starts_at, ends_at, '\[\)'::text\) && /,
      );

      // On every court and day measured, the bookings a plain comparison of the times selects.
      for (let index = 0; index < courtIds.length * DAYS.length; index += 1) {
        const { courtId, day } = pick(index);
        const { start, end } = calendarDay(day);
        const found = await repository.confirmedTimes(courtId, { start, end });
        const { rows: expected } = await pool.query<{ epochMs: number }>(
          `select extract(epoch from starts_at)::float8 * 1000 as "epochMs" from bookings
          where court_id = $1 and status = 'confirmed' and starts_at < $3 and ends_at > $2
          order by starts_at`,
          [courtId, start.toString(), end.toString()],
        );
        const starts = found.map((booking) => booking.start.epochMilliseconds);

        expect(starts.toSorted((a, b) => a - b)).toEqual(expected.map(({ epochMs }) => epochMs));
      }
    });

    it('measures the day view: BookingsRepository.listStartingIn', async () => {
      const measured = await measure(async ({ day }) =>
        repository.listStartingIn(calendarDay(day)),
      );

      result.listStartingIn = measured.timing;
      report('listStartingIn', measured);
      expect(measured.rows).toBe(BOOKINGS_PER_DAY);
      expect(indexCondition(measured.plan, 'bookings_starts_at_index')).toMatch(
        /^Index Cond: \(\(starts_at >= .+\) AND \(starts_at < .+\)\)$/,
      );
    });

    it('measures both routes end to end over HTTP', async () => {
      result.availabilityRoute = await time(RUNS, async (index) => {
        const { courtId, day } = pick(index);

        return get(`/courts/${courtId}/availability?date=${day.toString()}`, userCookie);
      });
      result.dayViewRoute = await time(RUNS, async (index) =>
        get(`/admin/bookings?date=${pick(index).day.toString()}`, adminCookie),
      );

      print();
      print(`GET /api/courts/:id/availability: ${medianAndP95(result.availabilityRoute)}`);
      print(`GET /api/admin/bookings: ${medianAndP95(result.dayViewRoute)}`);
      expect(result.availabilityRoute.medianMs).toBeGreaterThan(0);
      expect(result.dayViewRoute.medianMs).toBeGreaterThan(0);
    });
  });
});
