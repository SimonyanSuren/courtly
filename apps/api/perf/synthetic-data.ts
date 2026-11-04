import { sql } from 'drizzle-orm';

import { FACILITY_TIME_ZONE } from '../src/modules/courts/domain/opening-hours';
import { Role } from '../src/modules/users/domain/role';
import { type Database } from '../src/platform/database/database';

/** One facility's courts, each open from 08:00 to 22:00: seven 2-hour blocks a day. */
export const COURT_COUNT = 10;
const OPENING_HOUR = 8;
const CLOSING_HOUR = 22;
const BLOCKS_PER_DAY = (CLOSING_HOUR - OPENING_HOUR) / 2;

/** Customers the bookings are spread over. */
const CUSTOMER_COUNT = 1000;

/** The newest day with bookings. Fixed, so every run builds the same rows. */
export const LAST_DAY = Temporal.PlainDate.from('2026-12-31');

/**
 * What one 2-hour block of a court's day holds, by kind (0 to 9, each a tenth of the blocks):
 * the hour in the block each booking starts at, its hours and whether it was cancelled. Kind 9
 * holds nothing. Per ten blocks: 13 bookings, 2 of them cancelled, and 15 of the 20 hours booked.
 */
const BLOCK_KINDS = sql.raw(`(values
  (0, 0, 2, false), (1, 0, 2, false), (2, 0, 2, false),
  (3, 0, 1, false), (3, 1, 1, false),
  (4, 0, 1, false), (4, 1, 1, false),
  (5, 0, 1, false), (5, 1, 1, false),
  (6, 0, 1, false),
  (7, 0, 1, true), (7, 0, 2, false),
  (8, 0, 2, true)
) as kind (kind, first_hour, hours, cancelled)`);

/**
 * Bookings a day holds across the facility. A block's kind goes round with the day, the court and
 * the block (see replaceBookings): on any day, the ten courts' blocks at the same hour take each
 * kind once, so every day holds 7 blocks × 13 bookings.
 */
export const BOOKINGS_PER_DAY = BLOCKS_PER_DAY * 13;

/** The facility's courts and customers, the same at every size. */
export async function insertCourtsAndCustomers(db: Database): Promise<void> {
  await db.execute(sql`
    insert into courts (name, sport, hourly_price_cents, opening_hour, closing_hour)
    select
      'Court ' || lpad(n::text, 2, '0'),
      -- Each sport in turn, in the order the enum declares them.
      (enum_range(null::sport))[1 + (n - 1) % cardinality(enum_range(null::sport))],
      1000 + 200 * n,
      ${OPENING_HOUR}::int,
      ${CLOSING_HOUR}::int
    from generate_series(1, ${COURT_COUNT}::int) as n`);
  // Nobody logs in as them: the password hash is a placeholder that no password matches.
  await db.execute(sql`
    insert into users (email, name, role, password_hash)
    select 'customer-' || n || '@example.com', 'Customer ' || n, ${Role.USER}::user_role, 'none'
    from generate_series(1, ${CUSTOMER_COUNT}::int) as n`);
}

/**
 * Replaces every booking with `count` synthetic ones in one INSERT ... SELECT, on the newest days
 * up to LAST_DAY: the oldest day is the only one with fewer than BOOKINGS_PER_DAY. Each satisfies
 * every constraint of the table: whole hours from 08:00 to 22:00 on the facility's clock, 1 or 2
 * hours, no two confirmed bookings of a court overlapping, and a cancellation time exactly when
 * cancelled. A cancelled booking may overlap a confirmed one, as when someone else books the time
 * it freed. Rows go in in order of start, roughly the order a real facility's bookings arrive in.
 */
export async function replaceBookings(db: Database, count: number): Promise<void> {
  const days = Math.ceil(count / BOOKINGS_PER_DAY);

  await db.execute(sql`truncate bookings`);
  await db.execute(sql`
    with
      court as (
        select id, hourly_price_cents, row_number() over (order by name)::int as n
        from courts
      ),
      customer as (
        select id, row_number() over (order by email)::int - 1 as n
        from users
        where email like 'customer-%'
      ),
      booking as (
        select
          court.id as court_id,
          court.hourly_price_cents,
          kind.hours,
          kind.cancelled,
          -- A local date and hour on the facility's clock, as the moment it names.
          ((${LAST_DAY.toString()}::date - day.n)
            + make_time(${OPENING_HOUR}::int + 2 * block.n + kind.first_hour, 0, 0))
            at time zone ${FACILITY_TIME_ZONE} as starts_at,
          (day.n * 31 + court.n * 7 + block.n * 3 + kind.first_hour + kind.hours)
            % ${CUSTOMER_COUNT}::int as customer_n
        from generate_series(0, ${days - 1}::int) as day (n)
        cross join court
        cross join generate_series(0, ${BLOCKS_PER_DAY - 1}::int) as block (n)
        join ${BLOCK_KINDS} on kind.kind = (day.n * 7 + court.n * 3 + block.n) % 10
        order by starts_at desc, court.n, kind.hours, kind.cancelled
        limit ${count}
      )
    insert into bookings
      (user_id, court_id, starts_at, ends_at, hours, price_cents, status, created_at, cancelled_at)
    select
      customer.id,
      booking.court_id,
      booking.starts_at,
      booking.starts_at + make_interval(hours => booking.hours),
      booking.hours,
      booking.hourly_price_cents * booking.hours,
      (case when booking.cancelled then 'cancelled' else 'confirmed' end)::booking_status,
      -- Booked 3 days ahead; a cancelled one 5 days ahead, and cancelled a day later.
      booking.starts_at - case when booking.cancelled then interval '5 days' else interval '3 days' end,
      case when booking.cancelled then booking.starts_at - interval '4 days' end
    from booking
    join customer on customer.n = booking.customer_n
    order by booking.starts_at, booking.court_id`);
  // What autovacuum would do to a table this size: planner statistics, and a visibility map so a
  // scan does not have to check each row's visibility in the heap.
  await db.execute(sql`vacuum (analyze) bookings`);
}
