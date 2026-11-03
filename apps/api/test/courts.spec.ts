import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';

import { type Court, courts } from '../src/modules/courts/courts.schema';
import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestApp } from './create-test-app';
import { resetDatabase } from './database';
import { createUser, logIn } from './users';

const padel = {
  name: 'Padel 1',
  sport: 'padel',
  hourlyPriceCents: 2400,
  openingHour: 8,
  closingHour: 22,
} as const;

/** A UUID no court has. */
const UNKNOWN_ID = '019a4b2c-0000-7000-8000-000000000000';

function names(response: Response): string[] {
  return (response.body as Court[]).map(({ name }) => name);
}

describe('courts over HTTP', () => {
  let app: NestExpressApplication;
  let db: Database;
  let userCookie: string;
  let adminCookie: string;

  const get = async (path: string, cookie: string): Promise<Response> =>
    request(app.getHttpServer()).get(`/api/courts${path}`).set('Cookie', cookie);

  const post = async (body: Record<string, unknown>, cookie = adminCookie): Promise<Response> =>
    request(app.getHttpServer()).post('/api/courts').set('Cookie', cookie).send(body);

  const patch = async (
    id: string,
    body: Record<string, unknown>,
    cookie = adminCookie,
  ): Promise<Response> =>
    request(app.getHttpServer()).patch(`/api/courts/${id}`).set('Cookie', cookie).send(body);

  /** Inserts a court without the API, for tests about reading courts; returns its id. */
  const insertCourt = async (fields: Partial<typeof courts.$inferInsert> = {}): Promise<string> => {
    const [court] = await db
      .insert(courts)
      .values({ ...padel, ...fields })
      .returning({ id: courts.id });

    if (!court) {
      throw new Error('The insert returned no court.');
    }

    return court.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DATABASE);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await createUser(db, { email: 'ana@example.com', role: 'user' });
    await createUser(db, { email: 'admin@example.com', role: 'admin' });
    userCookie = await logIn(app, 'ana@example.com');
    adminCookie = await logIn(app, 'admin@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('needs a session for every route', async () => {
      const id = await insertCourt();
      const server = app.getHttpServer();

      const responses = [
        await request(server).get('/api/courts'),
        await request(server).get(`/api/courts/${id}`),
        await request(server).post('/api/courts').send(padel),
        await request(server).patch(`/api/courts/${id}`).send({ active: false }),
      ];

      expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401]);
    });

    it('lets users read courts, but not create or change them', async () => {
      const id = await insertCourt();

      const created = await post({ ...padel, name: 'Tennis 1' }, userCookie);
      const changed = await patch(id, { active: false }, userCookie);

      expect(created.status).toBe(403);
      expect(created.body).toMatchObject({ code: 'FORBIDDEN' });
      expect(changed.status).toBe(403);
      expect(await db.select({ name: courts.name, active: courts.active }).from(courts)).toEqual([
        { name: 'Padel 1', active: true },
      ]);
    });
  });

  describe('GET /api/courts', () => {
    it('lists the active courts to users and every court to admins, by name', async () => {
      await insertCourt({ name: 'Tennis 1', sport: 'tennis' });
      await insertCourt({ name: 'Old Court', active: false });
      await insertCourt({ name: 'Padel 1' });

      const asUser = await get('', userCookie);
      const asAdmin = await get('', adminCookie);

      expect(asUser.status).toBe(200);
      expect(names(asUser)).toEqual(['Padel 1', 'Tennis 1']);
      expect(asAdmin.status).toBe(200);
      expect(names(asAdmin)).toEqual(['Old Court', 'Padel 1', 'Tennis 1']);
    });
  });

  describe('GET /api/courts/:id', () => {
    it('answers the court with exactly the fields of a Court', async () => {
      const id = await insertCourt();

      const response = await get(`/${id}`, userCookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id, ...padel, active: true });
    });

    it('hides an inactive court from users with 404 and shows it to admins', async () => {
      const id = await insertCourt({ active: false });

      const asUser = await get(`/${id}`, userCookie);
      const asAdmin = await get(`/${id}`, adminCookie);

      expect(asUser.status).toBe(404);
      expect(asUser.body).toMatchObject({ code: 'COURT_NOT_FOUND' });
      expect(asAdmin.status).toBe(200);
      expect(asAdmin.body).toMatchObject({ id, active: false });
    });

    it.each([UNKNOWN_ID, 'not-a-uuid'])('answers 404 for the id %s', async (id) => {
      const response = await get(`/${id}`, adminCookie);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'There is no such court.',
        code: 'COURT_NOT_FOUND',
      });
    });
  });

  describe('POST /api/courts', () => {
    it('creates an active court and answers 201 with it', async () => {
      const response = await post(padel);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: expect.any(String), ...padel, active: true });

      const read = await get(`/${(response.body as Court).id}`, userCookie);

      expect(read.body).toEqual(response.body);
    });

    it('stores the name without the spaces around it', async () => {
      const response = await post({ ...padel, name: '  Padel 1 ' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ name: 'Padel 1' });
    });

    it('keeps the price as integer cents', async () => {
      const response = await post({ ...padel, hourlyPriceCents: 1999 });
      const read = await get(`/${(response.body as Court).id}`, userCookie);

      expect(response.body).toMatchObject({ hourlyPriceCents: 1999 });
      expect(read.body).toMatchObject({ hourlyPriceCents: 1999 });
      expect(await db.select({ price: courts.hourlyPriceCents }).from(courts)).toEqual([
        { price: 1999 },
      ]);
    });

    it('accepts the longest day, 0 to 24, and the highest price', async () => {
      const response = await post({
        ...padel,
        openingHour: 0,
        closingHour: 24,
        hourlyPriceCents: 100_000,
      });

      expect(response.status).toBe(201);
    });

    it.each([
      { problem: 'an empty name', change: { name: '' }, path: 'name' },
      { problem: 'a name of spaces only', change: { name: ' '.repeat(3) }, path: 'name' },
      { problem: 'a name over 100 characters', change: { name: 'x'.repeat(101) }, path: 'name' },
      { problem: 'an unknown sport', change: { sport: 'golf' }, path: 'sport' },
      { problem: 'a missing sport', change: { sport: undefined }, path: 'sport' },
      { problem: 'a price of 0', change: { hourlyPriceCents: 0 }, path: 'hourlyPriceCents' },
      {
        problem: 'a negative price',
        change: { hourlyPriceCents: -2400 },
        path: 'hourlyPriceCents',
      },
      { problem: 'part of a cent', change: { hourlyPriceCents: 2400.5 }, path: 'hourlyPriceCents' },
      {
        problem: 'a price in a string',
        change: { hourlyPriceCents: '2400' },
        path: 'hourlyPriceCents',
      },
      {
        problem: 'a price over €1,000',
        change: { hourlyPriceCents: 100_001 },
        path: 'hourlyPriceCents',
      },
      { problem: 'an opening hour not whole', change: { openingHour: 8.5 }, path: 'openingHour' },
      { problem: 'a closing hour not whole', change: { closingHour: 21.5 }, path: 'closingHour' },
      { problem: 'an opening hour before 0', change: { openingHour: -1 }, path: 'openingHour' },
      { problem: 'a closing hour after 24', change: { closingHour: 25 }, path: 'closingHour' },
      {
        problem: 'closing as it opens',
        change: { openingHour: 8, closingHour: 8 },
        path: 'closingHour',
      },
      {
        problem: 'closing before it opens',
        change: { openingHour: 22, closingHour: 8 },
        path: 'closingHour',
      },
    ])('answers 400 for $problem', async ({ change, path }) => {
      const response = await post({ ...padel, ...change });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ in: 'body', path }],
      });
      expect(await db.select().from(courts)).toEqual([]);
    });

    it('answers 409 for a name another court has, in any case and with spaces', async () => {
      await post(padel);

      const lowerCase = await post({ ...padel, name: 'padel 1' });
      const spaced = await post({ ...padel, name: ' PADEL 1  ' });

      expect(lowerCase.status).toBe(409);
      expect(lowerCase.body).toMatchObject({
        code: 'COURT_NAME_TAKEN',
        detail: 'Another court already has this name.',
      });
      expect(spaced.status).toBe(409);
    });

    it('lets only one of two simultaneous creates with the same name succeed', async () => {
      const responses = await Promise.all([post(padel), post({ ...padel, name: 'PADEL 1' })]);

      expect(responses.map(({ status }) => status).toSorted((a, b) => a - b)).toEqual([201, 409]);
      expect(await db.select().from(courts)).toHaveLength(1);
    });
  });

  describe('PATCH /api/courts/:id', () => {
    it('changes only the fields it is sent', async () => {
      const id = await insertCourt();

      const response = await patch(id, { hourlyPriceCents: 3000, sport: 'tennis' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id,
        ...padel,
        hourlyPriceCents: 3000,
        sport: 'tennis',
        active: true,
      });
    });

    it('answers an empty change with the court as it is', async () => {
      const id = await insertCourt();

      const response = await patch(id, {});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id, ...padel, active: true });
    });

    it('checks the opening hours as they would be after the change', async () => {
      // Open from 8 to 22.
      const id = await insertCourt();

      const closingAtOpening = await patch(id, { closingHour: 8 });
      const openingAtClosing = await patch(id, { openingHour: 22 });
      const closingEarlier = await patch(id, { closingHour: 9 });

      expect(closingAtOpening.status).toBe(400);
      expect(closingAtOpening.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        detail: 'The court must open before it closes.',
        errors: [{ in: 'body', path: 'closingHour' }],
      });
      expect(openingAtClosing.status).toBe(400);
      expect(closingEarlier.status).toBe(200);
      expect(closingEarlier.body).toMatchObject({ openingHour: 8, closingHour: 9 });
    });

    it.each([
      { change: { name: ' ' }, path: 'name' },
      { change: { hourlyPriceCents: 0 }, path: 'hourlyPriceCents' },
      { change: { openingHour: 7.5 }, path: 'openingHour' },
      { change: { active: 'no' }, path: 'active' },
    ])('answers 400 for $change', async ({ change, path }) => {
      const id = await insertCourt();

      const response = await patch(id, change);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ errors: [{ in: 'body', path }] });
    });

    it('deactivates a court, hiding it from users, and reactivates it', async () => {
      const id = await insertCourt();

      const deactivated = await patch(id, { active: false });
      const hidden = await get(`/${id}`, userCookie);

      expect(deactivated.status).toBe(200);
      expect(deactivated.body).toMatchObject({ active: false });
      expect(names(await get('', userCookie))).toEqual([]);
      expect(hidden.status).toBe(404);
      expect(names(await get('', adminCookie))).toEqual(['Padel 1']);

      const reactivated = await patch(id, { active: true });
      const shown = await get(`/${id}`, userCookie);

      expect(reactivated.body).toMatchObject({ active: true });
      expect(names(await get('', userCookie))).toEqual(['Padel 1']);
      expect(shown.status).toBe(200);
    });

    it('answers 409 when renaming a court to a name another court has', async () => {
      await insertCourt({ name: 'Padel 1' });
      const id = await insertCourt({ name: 'Padel 2' });

      const response = await patch(id, { name: 'padel 1' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'COURT_NAME_TAKEN' });
    });

    it('lets a court change the case of its own name', async () => {
      const id = await insertCourt({ name: 'Padel 1' });

      const response = await patch(id, { name: 'PADEL 1' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: 'PADEL 1' });
    });

    it.each([UNKNOWN_ID, 'not-a-uuid'])('answers 404 for the id %s', async (id) => {
      const response = await patch(id, { active: false });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'COURT_NOT_FOUND' });
    });
  });

  it('has no DELETE route: courts are never deleted', async () => {
    const id = await insertCourt();

    const response = await request(app.getHttpServer())
      .delete(`/api/courts/${id}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(404);
    expect(await db.select({ id: courts.id }).from(courts)).toEqual([{ id }]);
  });
});
