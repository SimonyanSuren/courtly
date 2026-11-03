import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';

import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestApp } from './create-test-app';
import { resetDatabase } from './database';
import { createUser, TEST_PASSWORD } from './users';

const ATTEMPTS_PER_IP = 4;
const ATTEMPTS_PER_EMAIL = 3;
const WINDOW_SECONDS = 15 * 60;

/** Boots the app with low login limits, trusting `trustProxyHops` proxies as compose does. */
async function createLimitedApp(trustProxyHops: number): Promise<NestExpressApplication> {
  const values = {
    LOGIN_ATTEMPTS_PER_IP: String(ATTEMPTS_PER_IP),
    LOGIN_ATTEMPTS_PER_EMAIL: String(ATTEMPTS_PER_EMAIL),
    TRUST_PROXY_HOPS: String(trustProxyHops),
  };
  const previous = Object.keys(values).map((key) => [key, process.env[key]] as const);
  Object.assign(process.env, values);

  try {
    // The configuration is read once, at startup.
    return await createTestApp();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }
}

// The counters live as long as the app, so each test uses its own client addresses and emails.
describe('login attempts over HTTP, behind one trusted proxy', () => {
  let app: NestExpressApplication;

  const attempt = async (
    email: string,
    clientAddress: string,
    password = 'not the password',
  ): Promise<Response> =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', clientAddress)
      .send({ email, password });

  beforeAll(async () => {
    app = await createLimitedApp(1);
    const db = app.get<Database>(DATABASE);
    await resetDatabase(db);
    await createUser(db, { email: 'ana@example.com' });
    await createUser(db, { email: 'rui@example.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse one attempt too many for an email with 429, even with the right password', async () => {
    for (let count = 1; count <= ATTEMPTS_PER_EMAIL; count += 1) {
      const response = await attempt('ana@example.com', '203.0.113.1');

      expect(response.status).toBe(401);
      // No rate-limit headers: they would tell an attacker how many tries remain.
      expect(Object.keys(response.headers).join(',')).not.toMatch(/ratelimit|retry-after/i);
    }

    const refused = await attempt('ana@example.com', '203.0.113.1', TEST_PASSWORD);

    expect(refused.status).toBe(429);
    expect(refused.body).toEqual({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many login attempts. Try again in 15 minutes.',
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
    });
    expect(Number(refused.get('Retry-After'))).toBeGreaterThan(WINDOW_SECONDS - 10);
    expect(Number(refused.get('Retry-After'))).toBeLessThanOrEqual(WINDOW_SECONDS);
    expect(refused.get('Set-Cookie')).toBeUndefined();
  });

  it('count an email in any case and spacing, from any address', async () => {
    const spellings = ['rui@example.com', ' RUI@example.com ', 'Rui@Example.COM'];

    for (const [index, email] of spellings.entries()) {
      const response = await attempt(email, `203.0.113.${String(10 + index)}`);

      expect(response.status).toBe(401);
    }

    const refused = await attempt('rui@example.com', '203.0.113.20', TEST_PASSWORD);

    expect(refused.status).toBe(429);
  });

  it('refuse one attempt too many from an address, whatever the email', async () => {
    for (let count = 1; count <= ATTEMPTS_PER_IP; count += 1) {
      const response = await attempt(`guess${String(count)}@example.com`, '198.51.100.1');

      expect(response.status).toBe(401);
    }

    const refused = await attempt('another@example.com', '198.51.100.1');
    const elsewhere = await attempt('another@example.com', '198.51.100.2');

    expect(refused.status).toBe(429);
    expect(elsewhere.status).toBe(401);
  });
});

describe('login attempts over HTTP, with no trusted proxy', () => {
  it('ignore X-Forwarded-For, so a client cannot dodge the limit with it', async () => {
    const app = await createLimitedApp(0);

    try {
      const attempt = async (index: number): Promise<Response> =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', `192.0.2.${String(index)}`)
          .send({ email: `guess${String(index)}@example.com`, password: 'not the password' });

      for (let index = 1; index <= ATTEMPTS_PER_IP; index += 1) {
        const response = await attempt(index);

        expect(response.status).toBe(401);
      }

      const refused = await attempt(ATTEMPTS_PER_IP + 1);

      expect(refused.status).toBe(429);
    } finally {
      await app.close();
    }
  });
});
