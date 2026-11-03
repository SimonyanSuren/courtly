import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { asc, eq } from 'drizzle-orm';
import request from 'supertest';

import { DEMO_BOOKINGS, DEMO_PASSWORD, seedDemoData, SeedResult } from '../src/demo-data';
import { bookings } from '../src/modules/bookings/bookings.schema';
import { COURT_NAME_UNIQUE, courts } from '../src/modules/courts/courts.schema';
import { users } from '../src/modules/users/users.schema';
import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestApp } from './create-test-app';
import { resetDatabase } from './database';
import { createUser } from './users';

// A Wednesday afternoon in summer (UTC+1): today's 10:00 booking is past, its 18:00 one upcoming.
const NOW = Temporal.Instant.from('2026-07-15T14:30:00+01:00');

const HOUR_MS = 3_600_000;

const byText = (a: string, b: string): number => a.localeCompare(b);

/**
 * Seeded at any of these times, every booking must be where the facility's clock puts it. The
 * clocks go forward on 29 March 2026 and back on 25 October; from these times, some bookings fall
 * on those days.
 */
const MOMENTS = [
  { now: '2026-07-15T14:30:00+01:00', today: '2026-07-15' },
  // 00:30 in Lisbon, still the day before in UTC.
  { now: '2026-07-14T23:30:00Z', today: '2026-07-15' },
  { now: '2026-03-28T12:00:00Z', today: '2026-03-28' },
  { now: '2026-03-29T12:00:00+01:00', today: '2026-03-29' },
  { now: '2026-03-31T12:00:00+01:00', today: '2026-03-31' },
  // 00:30 in Lisbon on the day the clocks go back, before they do; the day before in UTC.
  { now: '2026-10-24T23:30:00Z', today: '2026-10-25' },
  { now: '2026-10-25T12:00:00Z', today: '2026-10-25' },
  { now: '2026-10-26T12:00:00Z', today: '2026-10-26' },
];

interface SeededBooking {
  email: string;
  userCreatedAt: Date;
  court: string;
  active: boolean;
  hourlyPriceCents: number;
  openingHour: number;
  closingHour: number;
  courtCreatedAt: Date;
  startsAt: Date;
  endsAt: Date;
  hours: number;
  priceCents: number;
  status: string;
  createdAt: Date;
  cancelledAt: Date | null;
}

/** A moment as the facility's clock shows it, without the offset: 2026-07-16T18:00:00. */
function wallClock(date: Date): Temporal.PlainDateTime {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO('Europe/Lisbon')
    .toPlainDateTime();
}

/** Who booked which court when: `ana@example.com Padel 1 2026-07-16T18:00:00 2h confirmed`. */
function summary(
  booking: Pick<SeededBooking, 'email' | 'court' | 'hours' | 'status'>,
  start: string,
): string {
  return `${booking.email} ${booking.court} ${start} ${String(booking.hours)}h ${booking.status}`;
}

/** The rules a booking breaks, by name: none for a booking the API could have taken. */
function brokenRules(booking: SeededBooking, now: Temporal.Instant): string[] {
  const start = wallClock(booking.startsAt);
  const end = wallClock(booking.endsAt);
  const date = start.toPlainDate();
  const nowMs = now.epochMilliseconds;
  const createdMs = booking.createdAt.getTime();
  const cancelledMs = booking.cancelledAt?.getTime();
  const rules = {
    'starts on the hour': start.minute === 0 && start.second === 0 && start.millisecond === 0,
    'starts once the court opens': start.hour >= booking.openingHour,
    'ends by closing on its date':
      Temporal.PlainDateTime.compare(
        end,
        date.toPlainDateTime().add({ hours: booking.closingHour }),
      ) <= 0,
    "costs its court's price per hour":
      booking.priceCents === booking.hourlyPriceCents * booking.hours,
    'was made before it started': createdMs < booking.startsAt.getTime(),
    'was made before now': createdMs < nowMs,
    'was made after its user and court existed':
      booking.userCreatedAt.getTime() <= createdMs && booking.courtCreatedAt.getTime() <= createdMs,
    'was cancelled after it was made, before now, 2 hours or more before it started':
      cancelledMs === undefined ||
      (createdMs < cancelledMs &&
        cancelledMs < nowMs &&
        cancelledMs <= booking.startsAt.getTime() - 2 * HOUR_MS),
  };

  return Object.entries(rules)
    .filter(([, isKept]) => !isKept)
    .map(([rule]) => `${summary(booking, start.toString())}: ${rule}`);
}

describe('the demo seed', () => {
  let app: NestExpressApplication;
  let db: Database;

  /** Every seeded booking with its user and court, by start. */
  const seeded = async (): Promise<SeededBooking[]> =>
    db
      .select({
        email: users.email,
        userCreatedAt: users.createdAt,
        court: courts.name,
        active: courts.active,
        hourlyPriceCents: courts.hourlyPriceCents,
        openingHour: courts.openingHour,
        closingHour: courts.closingHour,
        courtCreatedAt: courts.createdAt,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        hours: bookings.hours,
        priceCents: bookings.priceCents,
        status: bookings.status,
        createdAt: bookings.createdAt,
        cancelledAt: bookings.cancelledAt,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .orderBy(asc(bookings.startsAt), asc(courts.name));

  /** Every row of the tables the seed fills. */
  const everything = async (): Promise<unknown> => ({
    users: await db.select().from(users).orderBy(asc(users.id)),
    courts: await db.select().from(courts).orderBy(asc(courts.id)),
    bookings: await db.select().from(bookings).orderBy(asc(bookings.id)),
  });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DATABASE);
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('into an empty database', () => {
    it('creates an admin, 2 users, courts of several sports and one inactive court', async () => {
      expect(await seedDemoData(db, NOW)).toBe(SeedResult.SEEDED);

      expect(
        await db.select({ email: users.email, role: users.role }).from(users).orderBy(users.email),
      ).toEqual([
        { email: 'admin@example.com', role: 'admin' },
        { email: 'ana@example.com', role: 'user' },
        { email: 'rui@example.com', role: 'user' },
      ]);

      const facility = await db.select().from(courts);
      const active = facility.filter((court) => court.active);
      expect(new Set(active.map(({ sport }) => sport)).size).toBeGreaterThanOrEqual(3);
      expect(facility.length - active.length).toBe(1);
    });

    it('books past and upcoming hours for both users, of 1 and 2 hours, some cancelled', async () => {
      await seedDemoData(db, NOW);
      const all = await seeded();
      const hasEnded = ({ endsAt }: SeededBooking): boolean =>
        endsAt.getTime() <= NOW.epochMilliseconds;
      const past = all.filter(hasEnded);
      const upcoming = all.filter((booking) => booking.startsAt.getTime() > NOW.epochMilliseconds);
      const tomorrow = all.filter(
        ({ startsAt }) => wallClock(startsAt).toPlainDate().toString() === '2026-07-16',
      );
      const statuses = (list: SeededBooking[]): string[] =>
        [...new Set(list.map(({ status }) => status))].toSorted(byText);

      expect(statuses(past)).toEqual(['cancelled', 'confirmed']);
      expect(statuses(upcoming)).toEqual(['cancelled', 'confirmed']);
      expect(new Set(all.map(({ hours }) => hours))).toEqual(new Set([1, 2]));
      expect(new Set(all.map(({ email }) => email))).toEqual(
        new Set(['ana@example.com', 'rui@example.com']),
      );
      // The day view for tomorrow shows several courts.
      expect(
        new Set(tomorrow.filter(({ status }) => status === 'confirmed').map(({ court }) => court))
          .size,
      ).toBeGreaterThan(1);
      // Deactivating a court kept its bookings.
      expect(past.filter(({ active }) => !active)).not.toHaveLength(0);
    });

    it.each(['admin@example.com', 'ana@example.com', 'rui@example.com'])(
      'lets %s log in with the demo password',
      async (email) => {
        await seedDemoData(db, NOW);

        const response = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: DEMO_PASSWORD });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ email });
      },
    );
  });

  describe.each(MOMENTS)('seeded at $now, on $today in Lisbon', ({ now: moment, today }) => {
    const now = Temporal.Instant.from(moment);

    it('puts each booking at its hour on its day, counted from today', async () => {
      await seedDemoData(db, now);
      const date = Temporal.PlainDate.from(today);

      const expected = DEMO_BOOKINGS.map((booking) =>
        summary(
          {
            email: booking.user,
            court: booking.court,
            hours: booking.hours,
            status: booking.cancelled === true ? 'cancelled' : 'confirmed',
          },
          date.add({ days: booking.day }).toPlainDateTime({ hour: booking.hour }).toString(),
        ),
      );
      const stored = await seeded();

      expect(
        stored
          .map((booking) => summary(booking, wallClock(booking.startsAt).toString()))
          .toSorted(byText),
      ).toEqual(expected.toSorted(byText));
    });

    it('keeps every booking within opening hours, at its price, and dated in order', async () => {
      await seedDemoData(db, now);
      const stored = await seeded();

      expect(stored.flatMap((booking) => brokenRules(booking, now))).toEqual([]);
    });

    it('has upcoming bookings as well as past ones', async () => {
      await seedDemoData(db, now);
      const all = await seeded();

      expect(
        all.filter(({ startsAt }) => startsAt.getTime() > now.epochMilliseconds),
      ).not.toHaveLength(0);
      expect(
        all.filter(({ endsAt }) => endsAt.getTime() <= now.epochMilliseconds),
      ).not.toHaveLength(0);
    });
  });

  describe('into a database that is not empty', () => {
    it('changes nothing when run again, even days later', async () => {
      await seedDemoData(db, NOW);
      const before = await everything();

      expect(await seedDemoData(db, NOW.add({ hours: 72 }))).toBe(SeedResult.SKIPPED);
      expect(await everything()).toEqual(before);
    });

    it('changes nothing where any user exists', async () => {
      await createUser(db, { email: 'someone@example.com' });

      expect(await seedDemoData(db, NOW)).toBe(SeedResult.SKIPPED);
      expect(await db.select({ email: users.email }).from(users)).toEqual([
        { email: 'someone@example.com' },
      ]);
      expect(await db.select().from(courts)).toEqual([]);
      expect(await db.select().from(bookings)).toEqual([]);
    });

    it('is all or nothing: when one insert fails, nothing it inserted stays', async () => {
      // No users, so the seed runs, but one of its court names is taken.
      await db.insert(courts).values({
        name: 'Tennis 1',
        sport: 'tennis',
        hourlyPriceCents: 1500,
        openingHour: 8,
        closingHour: 22,
      });

      // Drizzle's error wraps the driver's, which names the constraint.
      await expect(seedDemoData(db, NOW)).rejects.toMatchObject({
        cause: { code: '23505', constraint: COURT_NAME_UNIQUE },
      });
      expect(await db.select().from(users)).toEqual([]);
      expect(await db.select({ name: courts.name }).from(courts)).toEqual([{ name: 'Tennis 1' }]);
    });
  });
});
