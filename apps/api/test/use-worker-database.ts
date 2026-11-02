import { workerDatabaseName } from './database';

// Runs before each test file: points DATABASE_URL at the database of the Jest worker running the
// file (JEST_WORKER_ID counts from 1). global-setup.ts created it from the migrated one.
const url = new URL(process.env.DATABASE_URL ?? '');
url.pathname = `/${workerDatabaseName(process.env.JEST_WORKER_ID ?? '1')}`;
process.env.DATABASE_URL = url.href;
