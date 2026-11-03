import { createHash } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { eq, sql } from 'drizzle-orm';
import request, { type Response } from 'supertest';

import { sessions } from '../src/modules/auth/sessions/sessions.schema';
import { users } from '../src/modules/users/users.schema';
import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestApp } from './create-test-app';
import { resetDatabase } from './database';
import { createUser, TEST_PASSWORD } from './users';

// Tests run without SESSION_COOKIE_SECURE, so the cookie is Secure and carries the __Host- prefix.
const COOKIE_NAME = '__Host-session';

/** The session's Set-Cookie line from a response. */
function setCookieLine(response: Response): string {
  const line = response.get('Set-Cookie')?.find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));

  if (line === undefined) {
    throw new Error('The response set no session cookie.');
  }

  return line;
}

/** The `name=value` pair a browser sends back in its Cookie header. */
function sessionCookie(response: Response): string {
  return setCookieLine(response).split(';', 1)[0] ?? '';
}

describe('login and sessions over HTTP', () => {
  let app: NestExpressApplication;
  let db: Database;

  const login = async (body: Record<string, unknown>, cookie?: string): Promise<Response> => {
    const call = request(app.getHttpServer()).post('/api/auth/login');

    return (cookie === undefined ? call : call.set('Cookie', cookie)).send(body);
  };

  const me = async (cookie?: string): Promise<Response> => {
    const call = request(app.getHttpServer()).get('/api/auth/me');

    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  const ana = { email: 'ana@example.com', password: TEST_PASSWORD };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DATABASE);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await createUser(db, { email: ana.email, name: 'Ana Silva' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('answers with the user and sets the session in an httpOnly cookie', async () => {
      const response = await login(ana);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: expect.any(String),
        email: 'ana@example.com',
        name: 'Ana Silva',
        role: 'user',
      });

      const cookie = setCookieLine(response);
      // 32 random bytes in base64url are 43 characters.
      expect(cookie).toMatch(new RegExp(`^${COOKIE_NAME}=[\\w-]{43};`));
      expect(cookie).toContain('Max-Age=604800');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('stores only the SHA-256 hash of the session token', async () => {
      const token = sessionCookie(await login(ana)).slice(COOKIE_NAME.length + 1);
      const rows = await db.select({ tokenHash: sessions.tokenHash }).from(sessions);

      expect(rows).toEqual([{ tokenHash: createHash('sha256').update(token).digest('hex') }]);
    });

    it('accepts the email in any case and with spaces around it', async () => {
      const response = await login({ ...ana, email: '  Ana@Example.COM ' });

      expect(response.status).toBe(200);
    });

    it('gives a wrong password and an unknown email the same 401', async () => {
      const wrongPassword = await login({ ...ana, password: 'not the password' });
      const unknownEmail = await login({ ...ana, email: 'nobody@example.com' });

      expect(wrongPassword.status).toBe(401);
      expect(wrongPassword.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        detail: 'The email or password is not correct.',
      });
      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(wrongPassword.get('Set-Cookie')).toBeUndefined();
    });

    it('answers 400 when the password is missing', async () => {
      const response = await login({ email: ana.email });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('ends the session the browser had, so a planted token never becomes logged in', async () => {
      const first = sessionCookie(await login(ana));
      const second = sessionCookie(await login(ana, first));

      const withFirst = await me(first);
      const withSecond = await me(second);

      expect(withFirst.status).toBe(401);
      expect(withSecond.status).toBe(200);
    });

    it('rejects a login sent from another site with 403', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Origin', 'https://attacker.example')
        .send(ana);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('accepts a login sent from the same origin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Sec-Fetch-Site', 'same-origin')
        .send(ana);

      expect(response.status).toBe(200);
    });
  });

  describe('routes that need a session', () => {
    it('answer 401 without a session, or with one the server does not know', async () => {
      const withoutCookie = await me();
      const withUnknownToken = await me(`${COOKIE_NAME}=not-a-real-token`);

      expect(withoutCookie.status).toBe(401);
      expect(withoutCookie.body).toMatchObject({ code: 'UNAUTHORIZED' });
      expect(withUnknownToken.status).toBe(401);
    });

    it('answer 401 once the session has expired', async () => {
      const cookie = sessionCookie(await login(ana));
      await db.update(sessions).set({ expiresAt: sql`now() - interval '1 second'` });

      const response = await me(cookie);

      expect(response.status).toBe(401);
    });

    it('give the current user, with the role as it is now', async () => {
      const cookie = sessionCookie(await login(ana));
      await db.update(users).set({ role: 'admin' }).where(eq(users.email, ana.email));

      const response = await me(cookie);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: 'ana@example.com', role: 'admin' });
    });

    it('do not include the public health check', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('ends the session and clears the cookie', async () => {
      const cookie = sessionCookie(await login(ana));

      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(response.status).toBe(204);
      expect(setCookieLine(response)).toContain('Max-Age=0');
      expect(await db.select().from(sessions)).toEqual([]);

      const afterLogout = await me(cookie);

      expect(afterLogout.status).toBe(401);
    });

    it('also answers 204 without a session, clearing a stale cookie', async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/logout');

      expect(response.status).toBe(204);
      expect(setCookieLine(response)).toContain('Max-Age=0');
    });
  });
});

describe('the session cookie over plain HTTP', () => {
  it('is named "session" and not Secure when SESSION_COOKIE_SECURE is false', async () => {
    // As in compose.yaml: browsers keep a Secure cookie only over HTTPS.
    process.env.SESSION_COOKIE_SECURE = 'false';
    const app = await createTestApp();

    try {
      const db = app.get<Database>(DATABASE);
      await resetDatabase(db);
      await createUser(db, { email: 'ana@example.com' });

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ana@example.com', password: TEST_PASSWORD });
      const cookie = response.get('Set-Cookie')?.[0] ?? '';
      const meResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie.split(';', 1)[0] ?? '');

      expect(cookie).toMatch(/^session=[\w-]{43};/);
      expect(cookie).not.toContain('Secure');
      expect(meResponse.status).toBe(200);
    } finally {
      await app.close();
      delete process.env.SESSION_COOKIE_SECURE;
    }
  });
});
