import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
  // Shared with global-teardown.ts, which Jest runs in the same context.
  var postgresContainer: StartedPostgreSqlContainer | undefined;
}

/**
 * Starts one PostgreSQL for the whole test run, the same version as compose.yaml, so tests check
 * the real database engine. Test workers inherit DATABASE_URL from this process.
 */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:18.6-trixie').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  // Jest documents globals as the way to hand state from global setup to global teardown.
  // eslint-disable-next-line unicorn/no-global-object-property-assignment
  globalThis.postgresContainer = container;
}
