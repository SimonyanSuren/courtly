import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { z } from 'zod';

import { createTestApp } from './create-test-app';

const courtSchema = z.object({
  name: z.string().min(1),
  hourlyPrice: z.number().int().positive(),
});
const searchSchema = z.object({ sport: z.enum(['padel', 'tennis']) });
const idSchema = z.coerce.number().int().positive();

// No real endpoint exists yet, so this test-only controller exercises validation and errors.
@Controller('probe')
class ProbeController {
  @Post(':id')
  create(
    @Param('id', { schema: idSchema }) id: number,
    @Query({ schema: searchSchema }) query: z.output<typeof searchSchema>,
    @Body({ schema: courtSchema }) body: z.output<typeof courtSchema>,
  ): Record<string, unknown> {
    return { id, ...query, ...body };
  }

  @Get('failure')
  fail(): never {
    throw new Error('connection to db-internal:5432 refused');
  }
}

const validCourt = { name: 'Court 1', hourlyPrice: 2500 };

// HTTP tests boot the real AppModule and send requests through Nest, as a client would.
describe('the API over HTTP', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ProbeController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves routes under /api only', async () => {
    const unprefixed = await request(app.getHttpServer())
      .post('/probe/1?sport=padel')
      .send(validCourt);
    const prefixed = await request(app.getHttpServer())
      .post('/api/probe/1?sport=padel')
      .send(validCourt);

    expect(unprefixed.status).toBe(404);
    expect(prefixed.status).toBe(201);
    // The handler receives parsed values: the route parameter "1" arrives as the number 1.
    expect(prefixed.body).toEqual({ id: 1, sport: 'padel', ...validCourt });
  });

  it('answers an unknown route with Problem Details', async () => {
    const response = await request(app.getHttpServer()).get('/api/no-such-route').expect(404);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Cannot GET /api/no-such-route',
      code: 'NOT_FOUND',
    });
  });

  it('rejects an invalid body with 400 and the failing fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/1?sport=padel')
      .send({ name: '', hourlyPrice: 'free' })
      .expect(400);

    expect(response.body).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      errors: [
        { in: 'body', path: 'name', message: expect.any(String) },
        { in: 'body', path: 'hourlyPrice', message: expect.any(String) },
      ],
    });
  });

  it('rejects an invalid route parameter and query string', async () => {
    // Each argument is validated on its own, so each case keeps the other arguments valid.
    const response = await request(app.getHttpServer())
      .post('/api/probe/abc?sport=padel')
      .send(validCourt)
      .expect(400);
    expect(response.body).toMatchObject({
      errors: [{ in: 'param', path: 'id', message: expect.any(String) }],
    });

    const queryResponse = await request(app.getHttpServer())
      .post('/api/probe/1?sport=golf')
      .send(validCourt)
      .expect(400);
    expect(queryResponse.body).toMatchObject({
      errors: [{ in: 'query', path: 'sport', message: expect.any(String) }],
    });
  });

  it('answers malformed JSON with 400 Problem Details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/1?sport=padel')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 400, code: 'BAD_REQUEST' });
  });

  it('answers an unexpected error with 500 and reveals no internals', async () => {
    const response = await request(app.getHttpServer()).get('/api/probe/failure').expect(500);

    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      code: 'INTERNAL_SERVER_ERROR',
    });
    expect(response.text).not.toContain('db-internal');
  });

  it('does not name the framework in its headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/no-such-route');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
