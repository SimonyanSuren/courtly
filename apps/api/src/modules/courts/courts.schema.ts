import { type SQL, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { MAX_COURT_NAME_LENGTH, MAX_HOURLY_PRICE_CENTS, Sport } from './domain/court';

export const sport = pgEnum('sport', Sport);

/** Its unique violation answers COURT_NAME_TAKEN. */
export const COURT_NAME_UNIQUE = 'courts_name_unique';

// drizzle-kit copies a CHECK's SQL into the migration as it is: a ${value} would become a $1
// parameter, which DDL cannot have. sql.raw writes the number itself.
const literal = (value: number): SQL => sql.raw(String(value));

/** The facility's courts. Never deleted: bookings reference them, so they are deactivated. */
export const courts = pgTable(
  'courts',
  {
    // As for users: uuidv7() keeps new ids at the end of the index.
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    name: text('name').notNull(),
    sport: sport('sport').notNull(),
    hourlyPriceCents: integer('hourly_price_cents').notNull(),
    // Whole local hours; 24 is the midnight that ends the day.
    openingHour: integer('opening_hour').notNull(),
    closingHour: integer('closing_hour').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // The same rules as the request validation, so no other path can store a court the API refuses.
  (table) => [
    check('courts_name_trimmed', sql`${table.name} = btrim(${table.name})`),
    check(
      'courts_name_length',
      sql`char_length(${table.name}) between 1 and ${literal(MAX_COURT_NAME_LENGTH)}`,
    ),
    check(
      'courts_hourly_price_cents_range',
      sql`${table.hourlyPriceCents} between 1 and ${literal(MAX_HOURLY_PRICE_CENTS)}`,
    ),
    check(
      'courts_opening_hours_valid',
      sql`0 <= ${table.openingHour} and ${table.openingHour} < ${table.closingHour} and ${table.closingHour} <= 24`,
    ),
    // Names are stored trimmed, and this ignores case, so "Padel 1" and "padel 1" cannot both
    // exist: users would not tell them apart.
    uniqueIndex(COURT_NAME_UNIQUE).on(sql`lower(${table.name})`),
  ],
);

/** What the API shows of a court: every column but its creation time. */
export type Court = Pick<
  typeof courts.$inferSelect,
  'id' | 'name' | 'sport' | 'hourlyPriceCents' | 'openingHour' | 'closingHour' | 'active'
>;
