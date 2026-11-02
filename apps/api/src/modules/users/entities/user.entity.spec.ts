import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { resetDatabase } from '../../../../test/database';
import { type Database } from '../../../platform/database/database';
import { users } from './user.entity';

// Runs against this worker's migrated test database, so it checks the constraints the migration
// created, not just the TypeScript declaration.
describe('users table', () => {
  const alice = {
    email: 'alice@example.com',
    name: 'Alice',
    role: 'user',
    passwordHash: 'not-a-real-hash',
  } as const;
  let pool: Pool;
  let db: Database;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool });
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('gives a new user a UUIDv7 id and its creation time', async () => {
    const [user] = await db.insert(users).values(alice).returning();

    // The version is the first digit of the third group.
    expect(user?.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7/);
    expect(user?.createdAt).toBeInstanceOf(Date);
  });

  it('rejects an email with capital letters', async () => {
    const insert = db.insert(users).values({ ...alice, email: 'Alice@example.com' });

    // Drizzle wraps the driver's error; PostgreSQL's SQLSTATE 23514 is a check violation.
    await expect(insert).rejects.toMatchObject({
      cause: { code: '23514', constraint: 'users_email_lower_case' },
    });
  });

  it('rejects a second user with the same email', async () => {
    await db.insert(users).values(alice);

    const insert = db.insert(users).values({ ...alice, name: 'Another Alice' });

    // SQLSTATE 23505 is a unique violation.
    await expect(insert).rejects.toMatchObject({
      cause: { code: '23505', constraint: 'users_email_unique' },
    });
  });
});
