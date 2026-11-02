import { sql } from 'drizzle-orm';

import { type Database } from '../src/platform/database/database';

/**
 * The database the test files of one Jest worker use; global-setup.ts creates one per worker.
 * `workerId` is Jest's JEST_WORKER_ID: "1", "2", and so on.
 */
export function workerDatabaseName(workerId: string): string {
  return `courtly_test_${workerId}`;
}

/**
 * Empties every table, so a test starts from an empty database and inserts the rows it needs.
 * The table list comes from the database, so a new table needs no change here.
 */
export async function resetDatabase(db: Database): Promise<void> {
  const { rows } = await db.execute<{ name: string }>(
    sql`select tablename as name from pg_tables where schemaname = 'public'`,
  );

  if (rows.length === 0) {
    return;
  }

  // One statement for every table, so foreign keys between them need no CASCADE.
  const tables = sql.join(
    rows.map(({ name }) => sql.identifier(name)),
    sql`, `,
  );
  await db.execute(sql`truncate ${tables}`);
}
