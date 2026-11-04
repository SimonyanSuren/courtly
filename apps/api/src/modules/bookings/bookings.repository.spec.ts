import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { resetDatabase } from '../../../test/database';
import { type Database } from '../../platform/database/database';
import { courts } from '../courts/courts.schema';
import { users } from '../users/users.schema';
import { BookingsRepository } from './bookings.repository';
import { bookings } from './bookings.schema';
import { calendarDay } from './domain/slots';

/** A local time in Lisbon in July (UTC+1), such as `at('2026-07-15T10:00')`. */
const at = (moment: string): Date => new Date(`${moment}:00+01:00`);

// Availability marks slots again in code, so an HTTP test cannot see a query that returns too
// many bookings. These pin the query itself: which bookings count as overlapping a day.
describe('BookingsRepository.confirmedTimes', () => {
  let pool: Pool;
  let db: Database;
  let repository: BookingsRepository;
  let userId: string;
  let courtId: string;
  let otherCourtId: string;

  const insertBooking = async (
    start: string,
    hours: 1 | 2,
    fields: Partial<typeof bookings.$inferInsert> = {},
  ): Promise<void> => {
    const startsAt = at(start);

    await db.insert(bookings).values({
      userId,
      courtId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + hours * 3_600_000),
      hours,
      priceCents: 2400 * hours,
      ...fields,
    });
  };

  /** The starts of what confirmedTimes() finds on 15 July, in order. */
  const startsOnTheDay = async (): Promise<string[]> => {
    const times = await repository.confirmedTimes(
      courtId,
      calendarDay(Temporal.PlainDate.from('2026-07-15')),
    );

    // Compared as text: Jest's toEqual sees any two Temporal values as equal.
    return times.map(({ start }) => start.toString()).toSorted((a, b) => a.localeCompare(b));
  };

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool });
    repository = new BookingsRepository(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    const [user] = await db
      .insert(users)
      .values({ email: 'ana@example.com', name: 'Ana', role: 'user', passwordHash: 'not-a-hash' })
      .returning({ id: users.id });
    const inserted = await db
      .insert(courts)
      .values(
        ['Padel 1', 'Padel 2'].map((name) => ({
          name,
          sport: 'padel' as const,
          hourlyPriceCents: 2400,
          openingHour: 8,
          closingHour: 22,
        })),
      )
      .returning({ id: courts.id });
    userId = user?.id ?? '';
    courtId = inserted[0]?.id ?? '';
    otherCourtId = inserted[1]?.id ?? '';
  });

  afterAll(async () => {
    await pool.end();
  });

  it('leaves out bookings that only touch the day: ending at its first moment or starting at its end', async () => {
    await insertBooking('2026-07-14T23:00', 1);
    await insertBooking('2026-07-15T10:00', 1);
    await insertBooking('2026-07-16T00:00', 1);

    expect(await startsOnTheDay()).toEqual(['2026-07-15T09:00:00Z']);
  });

  it("finds a booking that crosses into the day, and none that is cancelled or another court's", async () => {
    await insertBooking('2026-07-14T23:00', 2);
    await insertBooking('2026-07-15T12:00', 1, {
      status: 'cancelled',
      cancelledAt: at('2026-07-14T12:00'),
    });
    await insertBooking('2026-07-15T14:00', 1, { courtId: otherCourtId });

    expect(await startsOnTheDay()).toEqual(['2026-07-14T22:00:00Z']);
  });
});
