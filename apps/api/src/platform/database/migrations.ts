import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { type Database } from './database';

/**
 * The SQL files drizzle-kit generates. The relative path is the same from src/ (tests) and from
 * dist/ (the build), since the build keeps the folder layout.
 */
const MIGRATIONS_FOLDER = path.join(__dirname, '../../../migrations');

/**
 * Applies, in order and in one transaction, the migrations the database has not recorded yet
 * (Drizzle records them in drizzle.__drizzle_migrations). Two runs at once could both apply the
 * same migration, so only one process runs it: the migrate command, or the test setup.
 */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
