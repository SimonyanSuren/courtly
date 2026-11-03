import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PasswordHasher } from '../src/modules/auth/password-hasher';
import { type User, users } from '../src/modules/users/users.schema';
import { type Database } from '../src/platform/database/database';

/** The password of every user createUser() makes. */
export const TEST_PASSWORD = 'correct horse battery staple';

const hasher = new PasswordHasher();

/** Inserts a user who logs in with TEST_PASSWORD. */
export async function createUser(
  db: Database,
  fields: Pick<User, 'email'> & Partial<Pick<User, 'name' | 'role'>>,
): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      name: 'Test User',
      role: 'user',
      ...fields,
      passwordHash: await hasher.hash(TEST_PASSWORD),
    })
    .returning();

  if (!user) {
    throw new Error('The insert returned no user.');
  }

  return user;
}

/** Logs in as a user createUser() made; returns the `name=value` pair for the Cookie header. */
export async function logIn(app: NestExpressApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD });
  const cookie = response.get('Set-Cookie')?.[0]?.split(';', 1)[0];

  if (cookie === undefined || response.status !== 200) {
    throw new Error(`Logging in as ${email} answered ${String(response.status)}.`);
  }

  return cookie;
}
