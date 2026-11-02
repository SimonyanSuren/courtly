import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { type GlobalConfig } from 'jest';
import { Client } from 'pg';

import { runMigrations } from '../src/platform/database/migrations';
import { workerDatabaseName } from './database';

declare global {
  // Shared with global-teardown.ts, which Jest runs in the same context.
  var postgresContainer: StartedPostgreSqlContainer | undefined;
}

/**
 * Starts one PostgreSQL for the whole test run, the same version as compose.yaml, so tests check
 * the real database engine. Applies every migration once, then copies the migrated database for
 * each Jest worker: test files run in parallel, and each worker can empty its tables without
 * touching another's data. Workers inherit DATABASE_URL from this process, and
 * use-worker-database.ts points it at their own copy.
 */
export default async function globalSetup(globalConfig: GlobalConfig): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:18.6-trixie').start();
  // Jest documents globals as the way to hand state from global setup to global teardown.
  // eslint-disable-next-line unicorn/no-global-object-property-assignment
  globalThis.postgresContainer = container;

  // One connection, not a pool: PostgreSQL copies a database only while no other session uses it.
  const client = new Client({ connectionString: container.getConnectionUri() });
  await client.connect();

  try {
    await runMigrations(drizzle({ client }));

    for (let worker = 1; worker <= globalConfig.maxWorkers; worker += 1) {
      await client.query(
        `create database ${workerDatabaseName(String(worker))} template ${container.getDatabase()}`,
      );
    }
  } finally {
    await client.end();
  }

  process.env.DATABASE_URL = container.getConnectionUri();
}
