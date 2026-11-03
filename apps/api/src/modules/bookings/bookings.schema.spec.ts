import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { resetDatabase } from '../../../test/database';
import { type Database } from '../../platform/database/database';
import { courts } from '../courts/courts.schema';
import { users } from '../users/users.schema';
import { bookings } from './bookings.schema';

const hour = (time: string): Date => new Date(`2026-07-15T${time}:00+01:00`);

async function insertCourt(db: Database, name = 'Padel 1'): Promise<string> {
  const [court] = await db
    .insert(courts)
    .values({ name, sport: 'padel', hourlyPriceCents: 2400, openingHour: 8, closingHour: 22 })
    .returning({ id: courts.id });

  return court?.id ?? '';
}

// Runs against this worker's migrated test database, so it checks the constraints the migrations
// created, the hand-written exclusion constraint included: no path into the table, not only the
// API's, can store a booking the API would refuse or two that overlap.
describe('bookings table', () => {
  let pool: Pool;
  let db: Database;
  let userId: string;
  let courtId: string;

  /** A confirmed booking from 10:00 to 11:00 on 15 July 2026, with the fields given replaced. */
  const booking = (
    fields: Partial<typeof bookings.$inferInsert> = {},
  ): typeof bookings.$inferInsert => ({
    userId,
    courtId,
    startsAt: hour('10:00'),
    endsAt: hour('11:00'),
    hours: 1,
    priceCents: 2400,
    ...fields,
  });

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool });
  });

  beforeEach(async () => {
    await resetDatabase(db);
    const [user] = await db
      .insert(users)
      .values({ email: 'ana@example.com', name: 'Ana', role: 'user', passwordHash: 'not-a-hash' })
      .returning({ id: users.id });
    userId = user?.id ?? '';
    courtId = await insertCourt(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('gives a new booking a UUIDv7 id, confirmed and not cancelled', async () => {
    const [created] = await db.insert(bookings).values(booking()).returning();

    expect(created?.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7/);
    expect(created?.status).toBe('confirmed');
    expect(created?.cancelledAt).toBeNull();
  });

  it.each([
    {
      problem: '3 hours',
      change: { hours: 3, endsAt: hour('13:00') },
      constraint: 'bookings_hours_valid',
    },
    {
      problem: 'an end that is not the start plus its hours',
      change: { hours: 2 },
      constraint: 'bookings_ends_after_hours',
    },
    {
      problem: 'an end before the start',
      change: { endsAt: hour('09:00') },
      constraint: 'bookings_ends_after_hours',
    },
    {
      problem: 'a price of 0',
      change: { priceCents: 0 },
      constraint: 'bookings_price_cents_positive',
    },
    {
      problem: 'a cancelled booking without its cancellation time',
      change: { status: 'cancelled' },
      constraint: 'bookings_cancelled_at_when_cancelled',
    },
    {
      problem: 'a confirmed booking with a cancellation time',
      change: { cancelledAt: hour('08:00') },
      constraint: 'bookings_cancelled_at_when_cancelled',
    },
  ] as const)('rejects $problem, breaking $constraint', async ({ change, constraint }) => {
    const insert = db.insert(bookings).values(booking(change));

    // SQLSTATE 23514 is a check violation.
    await expect(insert).rejects.toMatchObject({ cause: { code: '23514', constraint } });
  });

  it('counts real hours across a clock change: 00:00 to 03:00 is 2 hours when 01:00 is skipped', async () => {
    const insert = db.insert(bookings).values(
      booking({
        startsAt: new Date('2026-03-29T00:00:00+00:00'),
        endsAt: new Date('2026-03-29T03:00:00+01:00'),
        hours: 2,
      }),
    );

    await expect(insert).resolves.toBeDefined();
  });

  describe('no double booking', () => {
    it.each([
      { problem: 'the same hour', change: {} },
      {
        problem: '2 hours that cover it',
        change: { startsAt: hour('09:00'), endsAt: hour('11:00'), hours: 2 },
      },
      {
        problem: '2 hours that start within it',
        change: { startsAt: hour('10:00'), endsAt: hour('12:00'), hours: 2 },
      },
    ])('rejects a confirmed booking of the court for $problem', async ({ change }) => {
      await db.insert(bookings).values(booking());

      const insert = db.insert(bookings).values(booking(change));

      // SQLSTATE 23P01 is an exclusion violation.
      await expect(insert).rejects.toMatchObject({
        cause: { code: '23P01', constraint: 'bookings_no_overlap' },
      });
    });

    it('accepts bookings that only touch it, at another court, or over a cancelled one', async () => {
      const otherCourtId = await insertCourt(db, 'Padel 2');
      await db.insert(bookings).values(booking());
      await db.insert(bookings).values(
        booking({
          startsAt: hour('12:00'),
          endsAt: hour('13:00'),
          status: 'cancelled',
          cancelledAt: hour('08:00'),
        }),
      );

      const inserts = db
        .insert(bookings)
        .values([
          booking({ startsAt: hour('09:00'), endsAt: hour('10:00') }),
          booking({ startsAt: hour('11:00'), endsAt: hour('12:00') }),
          booking({ courtId: otherCourtId }),
          booking({ startsAt: hour('12:00'), endsAt: hour('13:00') }),
        ]);

      await expect(inserts).resolves.toBeDefined();
      expect(await db.select().from(bookings)).toHaveLength(6);
    });

    it('frees the time once a booking is cancelled', async () => {
      const [first] = await db.insert(bookings).values(booking()).returning({ id: bookings.id });
      await db
        .update(bookings)
        .set({ status: 'cancelled', cancelledAt: hour('08:00') })
        .where(eq(bookings.id, first?.id ?? ''));

      await expect(db.insert(bookings).values(booking())).resolves.toBeDefined();
    });
  });

  it('refuses to delete a court that has bookings', async () => {
    await db.insert(bookings).values(booking());

    const deletion = db.delete(courts).where(eq(courts.id, courtId));

    // SQLSTATE 23001 is a restrict violation: ON DELETE RESTRICT refuses the delete at once.
    await expect(deletion).rejects.toMatchObject({
      cause: { code: '23001', constraint: 'bookings_court_id_courts_id_fk' },
    });
  });
});
