import { drizzle } from 'drizzle-orm/node-postgres';

import { databaseConfig } from './platform/database/database.config';
import { runMigrations } from './platform/database/migrations';
import { createPool } from './platform/database/pool';

/**
 * Applies pending migrations, then exits: `npm run db:migrate`. Compiled with the API, so the
 * production image runs it with plain Node and needs no dev tools. A failure exits with code 1.
 */
async function migrateDatabase(): Promise<void> {
  // Validates DATABASE_URL and the pool settings, as the API does at startup.
  const config = databaseConfig();
  // No statement timeout: a migration may rightly run longer than a request, e.g. to build an
  // index on a large table.
  const pool = createPool({ ...config, statementTimeoutMs: 0 });

  try {
    await runMigrations(drizzle({ client: pool }));
  } finally {
    await pool.end();
  }
}

void migrateDatabase();
