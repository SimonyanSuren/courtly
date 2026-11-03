import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';

import {
  type AvailabilityResponse,
  type BookingResponse,
} from '../src/modules/bookings/dto/responses';
import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestAppWithClock, insertCourt, TestClock } from './bookings';
import { resetDatabase } from './database';
import { createUser, logIn } from './users';

/** A UUID no court has. */
const UNKNOWN_ID = '019a4b2c-0000-7000-8000-000000000000';

// Monday 13 July 2026 in Lisbon, before every day asked about below.
const NOW = '2026-07-13T12:00:00+01:00';

/** Each slot as its local start time and status: `10:00 taken`. */
function summary(response: Response): string[] {
  return (response.body as AvailabilityResponse).slots.map(
    ({ startsAt, status }) => `${startsAt.slice(11, 16)} ${status}`,
  );
}

describe('availability over HTTP', () => {
  const clock = new TestClock(NOW);
  let app: NestExpressApplication;
  let db: Database;
  let anaCookie: string;
  let beaCookie: string;
  let courtId: string;

  const availability = async (
    id: string,
    date: string | undefined,
    cookie = anaCookie,
  ): Promise<Response> =>
    request(app.getHttpServer())
      .get(`/api/courts/${id}/availability`)
      .query(date === undefined ? {} : { date })
      .set('Cookie', cookie);

  const book = async (
    startsAt: string,
    { hours = 1, court = courtId, cookie = anaCookie } = {},
  ): Promise<Response> =>
    request(app.getHttpServer())
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send({ courtId: court, startsAt, hours });

  const cancel = async (response: Response): Promise<void> => {
    await request(app.getHttpServer())
      .post(`/api/bookings/${(response.body as BookingResponse).id}/cancel`)
      .set('Cookie', anaCookie);
  };

  beforeAll(async () => {
    app = await createTestAppWithClock(clock);
    db = app.get(DATABASE);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    clock.set(NOW);
    await createUser(db, { email: 'ana@example.com' });
    await createUser(db, { email: 'bea@example.com' });
    anaCookie = await logIn(app, 'ana@example.com');
    beaCookie = await logIn(app, 'bea@example.com');
    courtId = await insertCourt(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers the court, the date and the day's slots from opening to closing", async () => {
    const response = await availability(courtId, '2026-07-15');
    const { court, date, slots } = response.body as AvailabilityResponse;

    expect(response.status).toBe(200);
    expect(court).toEqual({
      id: courtId,
      name: 'Padel 1',
      sport: 'padel',
      hourlyPriceCents: 2400,
      openingHour: 8,
      closingHour: 22,
      active: true,
    });
    expect(date).toBe('2026-07-15');
    expect(slots).toHaveLength(14);
    expect(slots[0]).toEqual({
      startsAt: '2026-07-15T08:00:00+01:00',
      endsAt: '2026-07-15T09:00:00+01:00',
      status: 'available',
    });
    expect(slots.at(-1)).toMatchObject({ endsAt: '2026-07-15T22:00:00+01:00' });
  });

  it('marks started slots, the slots confirmed bookings cover, and the rest available', async () => {
    const otherCourtId = await insertCourt(db, { name: 'Padel 2' });
    await book('2026-07-15T10:00:00+01:00');
    await book('2026-07-15T12:00:00+01:00', { hours: 2 });
    await book('2026-07-15T18:00:00+01:00', { cookie: beaCookie });
    await cancel(await book('2026-07-15T15:00:00+01:00'));
    await book('2026-07-15T16:00:00+01:00', { court: otherCourtId });
    clock.set('2026-07-15T10:30:00+01:00');

    const response = await availability(courtId, '2026-07-15');

    expect(summary(response)).toEqual([
      '08:00 started',
      '09:00 started',
      // Booked, but started: booking would refuse it as ALREADY_STARTED before SLOT_TAKEN.
      '10:00 started',
      '11:00 available',
      '12:00 taken',
      '13:00 taken',
      '14:00 available',
      // Cancelled.
      '15:00 available',
      // Booked at another court.
      '16:00 available',
      '17:00 available',
      '18:00 taken',
      '19:00 available',
      '20:00 available',
      '21:00 available',
    ]);
  });

  it('agrees with booking: available slots book, taken ones are refused, started ones too', async () => {
    await book('2026-07-15T12:00:00+01:00', { hours: 2 });
    await book('2026-07-15T18:00:00+01:00');
    clock.set('2026-07-15T10:30:00+01:00');
    const day = await availability(courtId, '2026-07-15');
    const { slots } = day.body as AvailabilityResponse;
    const answerFor = { available: 201, taken: 409, started: 422 };

    const answers: number[] = [];

    for (const slot of slots) {
      const response = await book(slot.startsAt, { cookie: beaCookie });
      answers.push(response.status);
    }

    expect(new Set(slots.map(({ status }) => status))).toEqual(
      new Set(['started', 'taken', 'available']),
    );
    expect(answers).toEqual(slots.map(({ status }) => answerFor[status]));
  });

  describe('the days the clocks change, at a court open all day', () => {
    beforeEach(async () => {
      courtId = await insertCourt(db, { name: 'All Day', openingHour: 0, closingHour: 24 });
    });

    it('has 23 slots on the day the clocks go forward, skipping 01:00', async () => {
      clock.set('2026-03-28T12:00:00+00:00');

      const day = await availability(courtId, '2026-03-29');
      const { slots } = day.body as AvailabilityResponse;

      expect(slots).toHaveLength(23);
      expect(slots.slice(0, 2)).toEqual([
        {
          startsAt: '2026-03-29T00:00:00+00:00',
          endsAt: '2026-03-29T02:00:00+01:00',
          status: 'available',
        },
        {
          startsAt: '2026-03-29T02:00:00+01:00',
          endsAt: '2026-03-29T03:00:00+01:00',
          status: 'available',
        },
      ]);
    });

    it('has 25 slots on the day the clocks go back, two at 01:00, each booked on its own', async () => {
      clock.set('2026-10-24T12:00:00+01:00');
      const booked = await book('2026-10-25T01:00:00+00:00');

      const response = await availability(courtId, '2026-10-25');

      expect(booked.status).toBe(201);
      expect((response.body as AvailabilityResponse).slots).toHaveLength(25);
      expect(summary(response).slice(0, 4)).toEqual([
        '00:00 available',
        '01:00 available',
        '01:00 taken',
        '02:00 available',
      ]);
    });

    it('counts a day from midnight to midnight in Lisbon, not in UTC', async () => {
      // 23:00 on the 14th in Lisbon is 22:00 UTC; 00:00 on the 15th is 23:00 UTC on the 14th.
      await book('2026-07-14T23:00:00+01:00');
      await book('2026-07-15T00:00:00+01:00');

      const response = await availability(courtId, '2026-07-15');

      expect(summary(response).slice(0, 2)).toEqual(['00:00 taken', '01:00 available']);
      expect(summary(response).at(-1)).toBe('23:00 available');
    });
  });

  it('answers 404 COURT_NOT_FOUND for an inactive court, an unknown one and a malformed id', async () => {
    const inactiveId = await insertCourt(db, { name: 'Old Court', active: false });

    const responses = [
      await availability(inactiveId, '2026-07-15'),
      await availability(UNKNOWN_ID, '2026-07-15'),
      await availability('not-a-uuid', '2026-07-15'),
    ];

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
    expect(responses.map(({ body }) => (body as { code: string }).code)).toEqual([
      'COURT_NOT_FOUND',
      'COURT_NOT_FOUND',
      'COURT_NOT_FOUND',
    ]);
  });

  it.each([undefined, '', '2026-02-30', '15-07-2026', '2026-7-15', 'tomorrow'])(
    'answers 400 for the date %j',
    async (date) => {
      const response = await availability(courtId, date);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ in: 'query', path: 'date' }],
      });
    },
  );

  it('is for users only: admins get 403, and no session 401', async () => {
    await createUser(db, { email: 'admin@example.com', role: 'admin' });
    const adminCookie = await logIn(app, 'admin@example.com');

    const asAdmin = await availability(courtId, '2026-07-15', adminCookie);
    const anonymous = await request(app.getHttpServer()).get(
      `/api/courts/${courtId}/availability?date=2026-07-15`,
    );

    expect(asAdmin.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });
});
