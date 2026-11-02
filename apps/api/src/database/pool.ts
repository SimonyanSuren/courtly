import { Logger } from '@nestjs/common';
import { Pool } from 'pg';

import { type DatabaseConfig } from './database.config';

/** Longest a connection may sit inside an open transaction before PostgreSQL ends the session. */
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;

const logger = new Logger('Database');

/** The API's one connection pool. */
export function createPool(config: DatabaseConfig): Pool {
  /* eslint-disable @typescript-eslint/naming-convention -- pg's option names */
  const pool = new Pool({
    connectionString: config.url,
    max: config.poolMax,
    // Fail a request that cannot get a connection instead of letting it wait forever.
    connectionTimeoutMillis: config.connectionTimeoutMs,
    // Session limits, so a runaway query or a forgotten transaction cannot hold locks forever.
    // PostgreSQL's docs advise setting statement_timeout per session, not server-wide.
    statement_timeout: config.statementTimeoutMs,
    idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
    // Tells the API's connections apart in pg_stat_activity.
    application_name: 'courtly-api',
  });
  /* eslint-enable @typescript-eslint/naming-convention */

  // pg reports a dropped idle connection (database restart, network cut) as an 'error' event.
  // Unhandled, Node would exit the process; the pool already discards the broken connection and
  // opens a new one for the next query, so a warning is enough.
  pool.on('error', (error) => {
    logger.warn(`Idle database connection lost: ${error.message}`);
  });

  return pool;
}
