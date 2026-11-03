import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { resetDatabase } from '../../../test/database';
import { type Database } from '../../platform/database/database';
import { courts } from './courts.schema';

// Runs against this worker's migrated test database, so it checks the constraints the migration
// created: no path into the table, not only the API's, can store a court the API would refuse.
describe('courts table', () => {
  const padel = {
    name: 'Padel 1',
    sport: 'padel',
    hourlyPriceCents: 2400,
    openingHour: 8,
    closingHour: 22,
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

  it('gives a new court a UUIDv7 id and makes it active', async () => {
    const [court] = await db.insert(courts).values(padel).returning();

    expect(court?.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7/);
    expect(court?.active).toBe(true);
  });

  it.each([
    { change: { name: '' }, constraint: 'courts_name_length' },
    { change: { name: 'x'.repeat(101) }, constraint: 'courts_name_length' },
    { change: { name: ' Padel 1' }, constraint: 'courts_name_trimmed' },
    { change: { hourlyPriceCents: 0 }, constraint: 'courts_hourly_price_cents_range' },
    { change: { hourlyPriceCents: 100_001 }, constraint: 'courts_hourly_price_cents_range' },
    { change: { openingHour: -1 }, constraint: 'courts_opening_hours_valid' },
    { change: { closingHour: 25 }, constraint: 'courts_opening_hours_valid' },
    { change: { openingHour: 22 }, constraint: 'courts_opening_hours_valid' },
  ])('rejects $change, breaking $constraint', async ({ change, constraint }) => {
    const insert = db.insert(courts).values({ ...padel, ...change });

    // SQLSTATE 23514 is a check violation.
    await expect(insert).rejects.toMatchObject({ cause: { code: '23514', constraint } });
  });

  it('rejects a second court whose name differs only in case', async () => {
    await db.insert(courts).values(padel);

    const insert = db.insert(courts).values({ ...padel, name: 'PADEL 1' });

    await expect(insert).rejects.toMatchObject({
      cause: { code: '23505', constraint: 'courts_name_unique' },
    });
  });
});
