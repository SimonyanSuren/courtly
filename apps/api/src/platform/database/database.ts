import { type NodePgDatabase } from 'drizzle-orm/node-postgres';

/** Injection token for the Drizzle instance: `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('DATABASE');

export type Database = NodePgDatabase;
