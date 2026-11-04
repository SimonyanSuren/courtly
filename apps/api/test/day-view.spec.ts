import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';

import { type BookingResponse } from '../src/modules/bookings/dto/booking.response';
import { type DayViewResponse } from '../src/modules/bookings/dto/day-view.response';
import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestAppWithClock, insertCourt, TestClock } from './bookings';
import { resetDatabase } from './database';
import { createUser, logIn } from './users';

/** A time on Wednesday 15 July 2026 in Lisbon, summer time (UTC+1): `at('10:00')`. */
const at = (time: string): string => `2026-07-15T${time}:00+01:00`;

// Monday 13 July 2026 in Lisbon, before every booking made below.
const NOW = '2026-07-13T12:00:00+01:00';

/** The day's bookings as their local start time and court: `10:00 Padel 1`. */
function starts(response: Response): string[] {
  return (response.body as DayViewResponse).bookings.map(
    ({ startsAt, court }) => `${startsAt.slice(11, 16)} ${court.name}`,
  );
}

describe('the admin day view over HTTP', () => {
  const clock = new TestClock(NOW);
  let app: NestExpressApplication;
  let db: Database;
  let anaId: string;
  let anaCookie: string;
  let beaCookie: string;
  let adminCookie: string;
  let courtId: string;

  const dayView = async (date: string | undefined, cookie = adminCookie): Promise<Response> =>
    request(app.getHttpServer())
      .get('/api/admin/bookings')
      .query(date === undefined ? {} : { date })
      .set('Cookie', cookie);

  /** Books through the API, as Ana unless told otherwise; returns the booking. */
  const book = async (
    startsAt: string,
    { hours = 1, court = courtId, cookie = anaCookie } = {},
  ): Promise<BookingResponse> => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send({ courtId: court, startsAt, hours });

    if (response.status !== 201) {
      throw new Error(`Booking ${startsAt} answered ${String(response.status)}.`);
    }

    return response.body as BookingResponse;
  };

  const changeCourt = async (id: string, changes: Record<string, unknown>): Promise<void> => {
    await request(app.getHttpServer())
      .patch(`/api/courts/${id}`)
      .set('Cookie', adminCookie)
      .send(changes);
  };

  beforeAll(async () => {
    app = await createTestAppWithClock(clock);
    db = app.get(DATABASE);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    clock.set(NOW);
    const ana = await createUser(db, { email: 'ana@example.com', name: 'Ana' });
    anaId = ana.id;
    await createUser(db, { email: 'bea@example.com', name: 'Bea' });
    await createUser(db, { email: 'admin@example.com', role: 'admin' });
    anaCookie = await logIn(app, 'ana@example.com');
    beaCookie = await logIn(app, 'bea@example.com');
    adminCookie = await logIn(app, 'admin@example.com');
    courtId = await insertCourt(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists the day's bookings at every court, inactive ones too, by court name and then start", async () => {
    const tennisId = await insertCourt(db, { name: 'Tennis 1', sport: 'tennis' });
    const oldCourtId = await insertCourt(db, { name: 'Old Court' });
    await book(at('09:00'), { court: tennisId });
    await book(at('18:00'), { hours: 2, cookie: beaCookie });
    const cancelled = await book(at('10:00'));
    await book(at('20:00'), { court: oldCourtId });
    await book('2026-07-16T10:00:00+01:00');
    await request(app.getHttpServer())
      .post(`/api/bookings/${cancelled.id}/cancel`)
      .set('Cookie', anaCookie);
    await changeCourt(oldCourtId, { active: false });

    const response = await dayView('2026-07-15');
    const { date, bookings } = response.body as DayViewResponse;

    expect(response.status).toBe(200);
    expect(date).toBe('2026-07-15');
    expect(
      bookings.map(({ court, startsAt, status, user }) =>
        [court.name, startsAt.slice(11, 16), status, user.name].join(' '),
      ),
    ).toEqual([
      'Old Court 20:00 confirmed Ana',
      'Padel 1 10:00 cancelled Ana',
      'Padel 1 18:00 confirmed Bea',
      'Tennis 1 09:00 confirmed Ana',
    ]);
  });

  it('shows each booking with its court, its user and its booked price', async () => {
    const booked = await book(at('10:00'), { hours: 2 });

    const day = await dayView('2026-07-15');
    const { bookings } = day.body as DayViewResponse;

    expect(bookings).toEqual([
      { ...booked, user: { id: anaId, name: 'Ana', email: 'ana@example.com' } },
    ]);
    expect(bookings[0]).toMatchObject({ priceCents: 4800, hours: 2 });
  });

  describe('expected revenue', () => {
    it('sums the confirmed bookings at their booked prices, as a number', async () => {
      await book(at('10:00'), { hours: 2 });
      await changeCourt(courtId, { hourlyPriceCents: 3000 });
      await book(at('14:00'));
      const cancelled = await book(at('16:00'));
      await request(app.getHttpServer())
        .post(`/api/bookings/${cancelled.id}/cancel`)
        .set('Cookie', anaCookie);

      const response = await dayView('2026-07-15');
      const { bookings, expectedRevenueCents } = response.body as DayViewResponse;

      expect(bookings).toHaveLength(3);
      // 2 hours at €24, then 1 at €30; the cancelled hour does not count.
      expect(expectedRevenueCents).toBe(4800 + 3000);
      expect(typeof expectedRevenueCents).toBe('number');
    });

    it('is the number 0 on a day without bookings', async () => {
      const response = await dayView('2026-07-15');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ date: '2026-07-15', bookings: [], expectedRevenueCents: 0 });
      expect(typeof (response.body as DayViewResponse).expectedRevenueCents).toBe('number');
    });
  });

  describe("the day, on the facility's clock", () => {
    beforeEach(async () => {
      courtId = await insertCourt(db, { name: 'All Day', openingHour: 0, closingHour: 24 });
    });

    it('runs from midnight to midnight in Lisbon, not in UTC', async () => {
      // 00:00 on the 15th in Lisbon is 23:00 UTC on the 14th.
      await book('2026-07-14T23:00:00+01:00');
      await book(at('00:00'));
      await book(at('23:00'));
      await book('2026-07-16T00:00:00+01:00');

      const response = await dayView('2026-07-15');

      expect(starts(response)).toEqual(['00:00 All Day', '23:00 All Day']);
    });

    it('holds all 25 hours of the day the clocks go back, both 01:00s included', async () => {
      clock.set('2026-10-24T12:00:00+01:00');
      await book('2026-10-25T00:00:00+01:00');
      await book('2026-10-25T01:00:00+01:00');
      await book('2026-10-25T01:00:00+00:00');
      await book('2026-10-25T23:00:00+00:00');
      await book('2026-10-26T00:00:00+00:00');

      const response = await dayView('2026-10-25');

      expect((response.body as DayViewResponse).bookings.map(({ startsAt }) => startsAt)).toEqual([
        '2026-10-25T00:00:00+01:00',
        '2026-10-25T01:00:00+01:00',
        '2026-10-25T01:00:00+00:00',
        '2026-10-25T23:00:00+00:00',
      ]);
    });
  });

  it.each([undefined, '', '2026-02-30', '15-07-2026', 'tomorrow'])(
    'answers 400 for the date %j',
    async (date) => {
      const response = await dayView(date);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ in: 'query', path: 'date', message: 'Must be a date such as 2026-11-05.' }],
      });
    },
  );

  it('is for admins only: users get 403, and no session 401', async () => {
    const asUser = await dayView('2026-07-15', anaCookie);
    const anonymous = await request(app.getHttpServer()).get('/api/admin/bookings?date=2026-07-15');

    expect(asUser.status).toBe(403);
    expect(asUser.body).toMatchObject({ code: 'FORBIDDEN' });
    expect(anonymous.status).toBe(401);
  });
});
