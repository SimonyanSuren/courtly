import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DEMO_PASSWORD, DEMO_USERS, seedDemoData, SeedResult } from './demo-data';
import { databaseConfig } from './platform/database/database.config';
import { createPool } from './platform/database/pool';

const logger = new Logger('Seed');

/**
 * Fills a fresh database with demo data around today, then exits: `npm run db:seed`, after the
 * migrations. A database that already has users is left as it is. Compiled with the API, so the
 * production image runs it with plain Node and needs no dev tools. A failure exits with code 1.
 */
async function seedDatabase(): Promise<void> {
  // Validates DATABASE_URL and the pool settings, as the API does at startup.
  const pool = createPool(databaseConfig());

  try {
    const result = await seedDemoData(drizzle({ client: pool }), Temporal.Now.instant());
    const emails = DEMO_USERS.map(({ email }) => email).join(', ');

    logger.log(
      result === SeedResult.SEEDED
        ? `Demo data seeded. Log in as ${emails} with the password ${DEMO_PASSWORD}.`
        : 'The database already has users: demo data not seeded.',
    );
  } finally {
    await pool.end();
  }
}

void seedDatabase();
