import { afterEach, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';

import { createTestApp } from './create-test-app';

describe('GET /api/health', () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('answers 200 when the database responds', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('survives the database dropping its connections, then answers 200 again', async () => {
    app = await createTestApp();
    // The first check leaves an idle connection in the pool.
    await request(app.getHttpServer()).get('/api/health').expect(200);

    // What a database restart does: end every other session, including the pool's idle one.
    // Only in this worker's database, so other test files running in parallel keep theirs.
    // Waits for 'remove', which the pool emits once it has discarded the dead connection. Not
    // for 'error', nor with events.once(): both add an 'error' listener that would hide a
    // missing one in the app.
    const pool = app.get(Pool);
    const connectionLost = new Promise((resolve) => pool.once('remove', resolve));
    const admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity
       where datname = current_database() and pid <> pg_backend_pid()`,
    );
    await admin.end();
    await connectionLost;

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(200);
  });

  it('answers 503 Problem Details when the database is unreachable', async () => {
    // Port 1 refuses connections at once, so the check fails without waiting for a timeout.
    const unreachable = new Pool({ connectionString: 'postgres://courtly:courtly@127.0.0.1:1/x' });
    app = await createTestApp({}, (builder) =>
      builder.overrideProvider(Pool).useValue(unreachable),
    );

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      detail: 'The database is not reachable.',
    });
  });
});
