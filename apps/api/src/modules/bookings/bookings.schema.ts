import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { courts } from '../courts/courts.schema';
import { users } from '../users/users.schema';
import { BookingStatus } from './domain/booking';

export const bookingStatus = pgEnum('booking_status', BookingStatus);

/**
 * The exclusion constraint that keeps two confirmed bookings of one court from overlapping; its
 * violation answers SLOT_TAKEN. Drizzle cannot declare an exclusion constraint, so the migration
 * 0004_bookings_no_overlap.sql creates it.
 */
export const BOOKINGS_NO_OVERLAP = 'bookings_no_overlap';

/** Courts booked by users, cancelled ones included. Never deleted: they are the day's records. */
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    // Restrict: a court or user with bookings cannot be deleted, or its records would go too.
    // Courts are deactivated instead.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    courtId: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    hours: integer('hours').notNull(),
    // The court's hourly price at booking time, times hours, so a later price change leaves it.
    priceCents: integer('price_cents').notNull(),
    status: bookingStatus('status').notNull().default(BookingStatus.CONFIRMED),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  // Every rule a row can be checked against on its own. Opening hours and the time now are not:
  // they change, and a booking stays valid once made.
  (table) => [
    check('bookings_hours_valid', sql`${table.hours} in (1, 2)`),
    // Adding an interval of hours to a timestamptz adds real hours, even across a clock change.
    check(
      'bookings_ends_after_hours',
      sql`${table.endsAt} = ${table.startsAt} + make_interval(hours => ${table.hours})`,
    ),
    check('bookings_price_cents_positive', sql`${table.priceCents} > 0`),
    check(
      'bookings_cancelled_at_when_cancelled',
      sql`(${table.status} = 'cancelled') = (${table.cancelledAt} is not null)`,
    ),
    // A user's bookings, and the bookings that start on a day. PostgreSQL does not index foreign
    // keys by itself.
    index('bookings_user_id_index').on(table.userId),
    index('bookings_starts_at_index').on(table.startsAt),
  ],
);
