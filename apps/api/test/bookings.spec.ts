import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { asc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import request, { type Response } from 'supertest';

import { bookings } from '../src/modules/bookings/bookings.schema';
import {
  type BookingResponse,
  type MyBookingsResponse,
} from '../src/modules/bookings/dto/responses';
import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestAppWithClock, insertCourt, TestClock } from './bookings';
import { resetDatabase } from './database';
import { createUser, logIn } from './users';

/** A UUID no booking or court has. */
const UNKNOWN_ID = '019a4b2c-0000-7000-8000-000000000000';

/** A time on Wednesday 15 July 2026 in Lisbon, summer time (UTC+1): `at('10:00')`. */
const at = (time: string): string => `2026-07-15T${time}:00+01:00`;

// Noon the day before, unless a test sets the clock itself.
const NOW = '2026-07-14T12:00:00+01:00';

/**
 * Polls until one of the API's connections waits for a lock while running `statement`. Each poll
 * is a transaction of its own: pg_stat_activity keeps one snapshot for a whole transaction.
 */
async function untilTheApiWaits(db: Database, statement: string): Promise<void> {
  const running = `${statement}%`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { rows } = await db.execute<{ waiting: number }>(sql`
      select count(*)::int as waiting from pg_stat_activity
      where datname = current_database() and application_name = 'courtly-api'
        and wait_event_type = 'Lock' and query like ${running}`);

    if (rows[0]?.waiting === 1) {
      return;
    }

    await sleep(20);
  }

  throw new Error(`The API never waited for the other transaction while running ${statement}.`);
}

/**
 * Runs `write` on a connection of its own in a transaction it keeps open, sends the API's
 * request, waits until the API's `statement` waits for that transaction, then ends it with `end`
 * and returns the API's answer.
 */
async function whileUncommitted(
  db: Database,
  {
    write,
    statement,
    end,
  }: {
    write: (other: Database) => Promise<unknown>;
    statement: string;
    end: 'commit' | 'rollback';
  },
  send: () => Promise<Response>,
): Promise<Response> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('begin');
    await write(drizzle({ client }));
    const response = send();
    await untilTheApiWaits(db, statement);
    await client.query(end);

    return await response;
  } finally {
    await client.end();
  }
}

/** Cancels the booking, as another request would; for whileUncommitted(). */
const cancelling =
  (id: string) =>
  async (other: Database): Promise<unknown> =>
    other
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(bookings.id, id));

describe('bookings over HTTP', () => {
  const clock = new TestClock(NOW);
  let app: NestExpressApplication;
  let db: Database;
  let beaId: string;
  let anaCookie: string;
  let beaCookie: string;
  let adminCookie: string;
  let courtId: string;

  /** Sends a booking of 1 hour at the court unless the fields say otherwise; Ana's by default. */
  const book = async (fields: Record<string, unknown>, cookie = anaCookie): Promise<Response> =>
    request(app.getHttpServer())
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send({ courtId, hours: 1, ...fields });

  /** Books through the API and returns the booking's id. */
  const bookId = async (startsAt: string, hours = 1, cookie = anaCookie): Promise<string> => {
    const response = await book({ startsAt, hours }, cookie);

    if (response.status !== 201) {
      throw new Error(`Booking ${startsAt} answered ${String(response.status)}.`);
    }

    return (response.body as BookingResponse).id;
  };

  const cancel = async (id: string, cookie = anaCookie): Promise<Response> =>
    request(app.getHttpServer()).post(`/api/bookings/${id}/cancel`).set('Cookie', cookie);

  const listMine = async (cookie = anaCookie): Promise<Response> =>
    request(app.getHttpServer()).get('/api/bookings').set('Cookie', cookie);

  /** Ana's bookings, as GET /api/bookings answers them. */
  const mine = async (): Promise<MyBookingsResponse> => {
    const response = await listMine();

    return response.body as MyBookingsResponse;
  };

  const changeCourt = async (changes: Record<string, unknown>): Promise<Response> =>
    request(app.getHttpServer())
      .patch(`/api/courts/${courtId}`)
      .set('Cookie', adminCookie)
      .send(changes);

  /** Every stored booking's start and status, by start. */
  const stored = async (): Promise<Array<{ startsAt: string; status: string }>> => {
    const rows = await db
      .select({ startsAt: bookings.startsAt, status: bookings.status })
      .from(bookings)
      .orderBy(asc(bookings.startsAt));

    return rows.map(({ startsAt, status }) => ({ startsAt: startsAt.toISOString(), status }));
  };

  /** Bea's confirmed booking from `startsAt`, as another connection inserts it. */
  const othersBooking =
    (startsAt: string, hours: number) =>
    async (other: Database): Promise<unknown> => {
      const start = Temporal.Instant.from(startsAt);

      return other.insert(bookings).values({
        userId: beaId,
        courtId,
        startsAt: new Date(start.epochMilliseconds),
        endsAt: new Date(start.add({ hours }).epochMilliseconds),
        hours,
        priceCents: 2400 * hours,
      });
    };

  beforeAll(async () => {
    app = await createTestAppWithClock(clock);
    db = app.get(DATABASE);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    clock.set(NOW);
    await createUser(db, { email: 'ana@example.com', name: 'Ana' });
    const bea = await createUser(db, { email: 'bea@example.com', name: 'Bea' });
    beaId = bea.id;
    await createUser(db, { email: 'admin@example.com', role: 'admin' });
    anaCookie = await logIn(app, 'ana@example.com');
    beaCookie = await logIn(app, 'bea@example.com');
    adminCookie = await logIn(app, 'admin@example.com');
    courtId = await insertCourt(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('needs a session for every route', async () => {
      const server = app.getHttpServer();

      const responses = [
        await request(server)
          .post('/api/bookings')
          .send({ courtId, startsAt: at('10:00') }),
        await request(server).get('/api/bookings'),
        await request(server).post(`/api/bookings/${UNKNOWN_ID}/cancel`),
      ];

      expect(responses.map(({ status }) => status)).toEqual([401, 401, 401]);
    });

    it('lets admins neither book, list nor cancel bookings', async () => {
      const id = await bookId(at('10:00'));

      const responses = [
        await book({ startsAt: at('12:00') }, adminCookie),
        await listMine(adminCookie),
        await cancel(id, adminCookie),
      ];

      expect(responses.map(({ status }) => status)).toEqual([403, 403, 403]);
      expect(responses[0]?.body).toMatchObject({ code: 'FORBIDDEN' });
      expect(await stored()).toEqual([
        { startsAt: '2026-07-15T09:00:00.000Z', status: 'confirmed' },
      ]);
    });
  });

  describe('POST /api/bookings', () => {
    it('books an hour and answers 201 with the booking', async () => {
      const response = await book({ startsAt: at('10:00') });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(String),
        court: { id: courtId, name: 'Padel 1', sport: 'padel' },
        startsAt: '2026-07-15T10:00:00+01:00',
        endsAt: '2026-07-15T11:00:00+01:00',
        hours: 1,
        priceCents: 2400,
        status: 'confirmed',
        cancellableUntil: '2026-07-15T08:00:00+01:00',
        // The real time of the insert, not the test's clock; with the facility's offset.
        createdAt: expect.stringMatching(/[+-]\d\d:\d\d$/),
        cancelledAt: null,
      });
    });

    it('books 2 consecutive hours at twice the hourly price', async () => {
      const response = await book({ startsAt: at('10:00'), hours: 2 });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        endsAt: '2026-07-15T12:00:00+01:00',
        hours: 2,
        priceCents: 4800,
      });
    });

    it("accepts a start with any offset and answers with the facility's", async () => {
      const summer = await book({ startsAt: '2026-07-15T09:00:00Z' });
      const winter = await book({ startsAt: '2026-11-05T18:00:00Z' });

      expect(summer.body).toMatchObject({ startsAt: '2026-07-15T10:00:00+01:00' });
      expect(winter.body).toMatchObject({
        startsAt: '2026-11-05T18:00:00+00:00',
        endsAt: '2026-11-05T19:00:00+00:00',
      });
    });

    it.each([
      { problem: '0 hours', change: { hours: 0 }, path: 'hours' },
      { problem: '3 hours', change: { hours: 3 }, path: 'hours' },
      { problem: 'part of an hour', change: { hours: 1.5 }, path: 'hours' },
      { problem: 'hours in a string', change: { hours: '1' }, path: 'hours' },
      {
        problem: 'a start without an offset',
        change: { startsAt: '2026-07-15T10:00:00' },
        path: 'startsAt',
      },
      { problem: 'a start that is not a time', change: { startsAt: 'tomorrow' }, path: 'startsAt' },
      {
        problem: 'a start with more decimals than Temporal reads',
        change: { startsAt: '2026-07-15T10:00:00.0000000000+01:00' },
        path: 'startsAt',
      },
      { problem: 'a court id that is not a UUID', change: { courtId: 'court-1' }, path: 'courtId' },
    ])('answers 400 for $problem', async ({ change, path }) => {
      const response = await book({ startsAt: at('10:00'), ...change });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ in: 'body', path }],
      });
      expect(await stored()).toEqual([]);
    });

    it.each([at('10:30'), '2026-07-15T10:00:00.001+01:00'])(
      'answers 422 NOT_ON_THE_HOUR for a start at %s',
      async (startsAt) => {
        const response = await book({ startsAt });

        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({
          code: 'NOT_ON_THE_HOUR',
          detail: 'A booking must start on the hour.',
        });
      },
    );

    describe('opening hours, 08:00 to 22:00', () => {
      it.each([
        { problem: 'an hour before opening', startsAt: at('07:00'), hours: 1 },
        { problem: '2 hours that start before opening', startsAt: at('07:00'), hours: 2 },
        { problem: 'an hour that ends after closing', startsAt: at('22:00'), hours: 1 },
        { problem: '2 hours whose second is past closing', startsAt: at('21:00'), hours: 2 },
      ])('answers 422 OUTSIDE_OPENING_HOURS for $problem', async ({ startsAt, hours }) => {
        const response = await book({ startsAt, hours });

        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({
          code: 'OUTSIDE_OPENING_HOURS',
          detail: 'The court is not open for all of that time.',
        });
        expect(await stored()).toEqual([]);
      });

      it('accepts the first hour, and 2 hours that end exactly at closing', async () => {
        const first = await book({ startsAt: at('08:00') });
        const last = await book({ startsAt: at('20:00'), hours: 2 });

        expect([first.status, last.status]).toEqual([201, 201]);
      });
    });

    describe('the time now', () => {
      it('answers 422 ALREADY_STARTED for a start in the past', async () => {
        const response = await book({ startsAt: '2026-07-13T10:00:00+01:00' });

        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({
          code: 'ALREADY_STARTED',
          detail: 'That time has already started.',
        });
      });

      it('answers 422 ALREADY_STARTED for an hour that has started, from its first moment', async () => {
        clock.set(at('10:30'));
        const during = await book({ startsAt: at('10:00') });
        clock.set(at('10:00'));
        const atStart = await book({ startsAt: at('10:00') });

        expect(during.body).toMatchObject({ status: 422, code: 'ALREADY_STARTED' });
        expect(atStart.body).toMatchObject({ status: 422, code: 'ALREADY_STARTED' });
      });

      it('accepts an hour that starts 1 ms from now', async () => {
        clock.set('2026-07-15T09:59:59.999+01:00');

        const response = await book({ startsAt: at('10:00') });

        expect(response.status).toBe(201);
      });
    });

    it('answers 404 COURT_NOT_FOUND for an unknown court and for an inactive one', async () => {
      const inactiveId = await insertCourt(db, { name: 'Old Court', active: false });

      const unknown = await book({ courtId: UNKNOWN_ID, startsAt: at('10:00') });
      const inactive = await book({ courtId: inactiveId, startsAt: at('10:00') });

      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ code: 'COURT_NOT_FOUND' });
      expect(inactive.status).toBe(404);
      expect(inactive.body).toMatchObject({ code: 'COURT_NOT_FOUND' });
      expect(await stored()).toEqual([]);
    });

    describe('taken times', () => {
      it('answers 409 SLOT_TAKEN for an hour someone else has booked', async () => {
        await bookId(at('10:00'));

        const response = await book({ startsAt: at('10:00') }, beaCookie);

        expect(response.status).toBe(409);
        expect(response.body).toEqual({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'Someone else booked this court for that time.',
          code: 'SLOT_TAKEN',
        });
      });

      it('answers 409 for 2 hours that cover a booked one, and for an hour within 2 booked ones', async () => {
        await bookId(at('11:00'));
        await bookId(at('14:00'), 2);

        const covering = await book({ startsAt: at('10:00'), hours: 2 }, beaCookie);
        const within = await book({ startsAt: at('15:00') }, beaCookie);

        expect([covering.status, within.status]).toEqual([409, 409]);
      });

      it('accepts bookings that end as the next starts, and the same hour at another court', async () => {
        const otherCourtId = await insertCourt(db, { name: 'Padel 2' });
        await bookId(at('10:00'));

        const responses = [
          await book({ startsAt: at('09:00') }, beaCookie),
          await book({ startsAt: at('11:00'), hours: 2 }, beaCookie),
          await book({ courtId: otherCourtId, startsAt: at('10:00') }, beaCookie),
        ];

        expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
      });

      it('frees the time of a cancelled booking for a new one', async () => {
        const id = await bookId(at('10:00'), 2);
        await cancel(id);

        const response = await book({ startsAt: at('11:00') }, beaCookie);

        expect(response.status).toBe(201);
      });
    });

    it("keeps the price a booking was made at when the court's price changes", async () => {
      await bookId(at('10:00'), 2);

      const changed = await changeCourt({ hourlyPriceCents: 3000 });
      await bookId(at('14:00'));
      const { upcoming } = await mine();

      expect(changed.status).toBe(200);
      expect(upcoming.map(({ priceCents }) => priceCents)).toEqual([4800, 3000]);
    });
  });

  // Two requests sent at once rarely overlap: the first usually commits before the second
  // starts, and a lookup before the insert would then pass too. These tests force the overlap.
  // Another connection writes in a transaction it keeps open, as a request that has written but
  // not committed yet. The API's request runs meanwhile, and only once PostgreSQL makes the API's
  // statement wait for that transaction does the test commit it or roll it back.
  describe('two requests at the same moment', () => {
    const inserting = { statement: 'insert into "bookings"' };
    const updating = { statement: 'update "bookings"' };

    it('answers 409 SLOT_TAKEN when the other booking of the hour commits', async () => {
      const response = await whileUncommitted(
        db,
        { ...inserting, write: othersBooking(at('10:00'), 1), end: 'commit' },
        async () => book({ startsAt: at('10:00') }),
      );

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'SLOT_TAKEN' });
      expect(await stored()).toEqual([
        { startsAt: '2026-07-15T09:00:00.000Z', status: 'confirmed' },
      ]);
    });

    it('books the hour when the other booking rolls back', async () => {
      const response = await whileUncommitted(
        db,
        { ...inserting, write: othersBooking(at('10:00'), 1), end: 'rollback' },
        async () => book({ startsAt: at('10:00') }),
      );

      expect(response.status).toBe(201);
      expect(await stored()).toHaveLength(1);
    });

    it('answers 409 for an hour that starts within the 2 hours the other booking holds', async () => {
      const response = await whileUncommitted(
        db,
        { ...inserting, write: othersBooking(at('10:00'), 2), end: 'commit' },
        async () => book({ startsAt: at('11:00') }),
      );

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'SLOT_TAKEN' });
    });

    it('answers 409 BOOKING_ALREADY_CANCELLED when another cancel commits first', async () => {
      const id = await bookId(at('18:00'));

      const response = await whileUncommitted(
        db,
        { ...updating, write: cancelling(id), end: 'commit' },
        async () => cancel(id),
      );

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'BOOKING_ALREADY_CANCELLED' });
    });

    it('cancels when the other cancel rolls back', async () => {
      const id = await bookId(at('18:00'));

      const response = await whileUncommitted(
        db,
        { ...updating, write: cancelling(id), end: 'rollback' },
        async () => cancel(id),
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'cancelled' });
    });
  });

  describe('GET /api/bookings', () => {
    it('splits the own bookings into upcoming, soonest first, and past, most recent first', async () => {
      const first = await bookId(at('10:00'));
      const second = await bookId(at('14:00'), 2);
      const current = await bookId('2026-07-16T10:00:00+01:00');
      const later = await bookId('2026-07-17T10:00:00+01:00');
      await cancel(later);
      await bookId('2026-07-16T12:00:00+01:00', 1, beaCookie);
      // During the third booking: it has started but not ended.
      clock.set('2026-07-16T10:30:00+01:00');

      const response = await listMine();
      const { upcoming, past } = response.body as MyBookingsResponse;

      expect(response.status).toBe(200);
      expect(upcoming.map(({ id, status }) => [id, status])).toEqual([
        [current, 'confirmed'],
        [later, 'cancelled'],
      ]);
      expect(past.map(({ id }) => id)).toEqual([second, first]);
    });

    it('moves a booking to the past at the moment it ends', async () => {
      const id = await bookId(at('10:00'));

      clock.set('2026-07-15T10:59:59.999+01:00');
      const before = await mine();
      clock.set(at('11:00'));
      const after = await mine();

      expect(before.upcoming.map((booking) => booking.id)).toEqual([id]);
      expect(after.upcoming).toEqual([]);
      expect(after.past.map((booking) => booking.id)).toEqual([id]);
    });

    it('keeps the bookings of a court that is deactivated, which takes no new ones', async () => {
      const id = await bookId(at('10:00'));

      const deactivated = await changeCourt({ active: false });
      const { upcoming } = await mine();
      const another = await book({ startsAt: at('12:00') });

      expect(deactivated.status).toBe(200);
      expect(upcoming).toEqual([
        expect.objectContaining({
          id,
          status: 'confirmed',
          court: { id: courtId, name: 'Padel 1', sport: 'padel' },
        }),
      ]);
      expect(another.status).toBe(404);
    });
  });

  describe('POST /api/bookings/:id/cancel', () => {
    it('cancels the booking and answers 200 with it, cancelled now', async () => {
      const id = await bookId(at('18:00'));
      clock.set(at('09:15'));

      const response = await cancel(id);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id,
        status: 'cancelled',
        cancelledAt: '2026-07-15T09:15:00+01:00',
      });
      expect(await mine()).toMatchObject({
        upcoming: [{ id, status: 'cancelled', cancelledAt: '2026-07-15T09:15:00+01:00' }],
      });
    });

    it('allows cancelling until exactly 2 hours before the start, not 1 ms later', async () => {
      const id = await bookId(at('18:00'));

      clock.set('2026-07-15T16:00:00.001+01:00');
      const late = await cancel(id);
      clock.set('2026-07-15T16:00:00.000+01:00');
      const onTime = await cancel(id);

      expect(late.status).toBe(422);
      expect(late.body).toMatchObject({
        code: 'CANCELLATION_WINDOW_CLOSED',
        detail: 'A booking can be cancelled until 2 hours before it starts.',
      });
      expect(onTime.status).toBe(200);
      expect(onTime.body).toMatchObject({ cancellableUntil: '2026-07-15T16:00:00+01:00' });
    });

    it('answers 409 BOOKING_ALREADY_CANCELLED for a booking cancelled before', async () => {
      const id = await bookId(at('18:00'));
      await cancel(id);

      const response = await cancel(id);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'BOOKING_ALREADY_CANCELLED',
        detail: 'This booking is already cancelled.',
      });
    });

    it("answers 404 for another user's booking, as if it did not exist, and leaves it", async () => {
      const id = await bookId(at('18:00'));

      const response = await cancel(id, beaCookie);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'There is no such booking.',
        code: 'BOOKING_NOT_FOUND',
      });
      expect(await stored()).toEqual([
        { startsAt: '2026-07-15T17:00:00.000Z', status: 'confirmed' },
      ]);
    });

    it.each([UNKNOWN_ID, 'not-a-uuid'])(
      'answers 404 BOOKING_NOT_FOUND for the id %s',
      async (id) => {
        const response = await cancel(id);

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ code: 'BOOKING_NOT_FOUND' });
      },
    );
  });
});
