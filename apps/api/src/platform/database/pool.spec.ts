import { afterEach, describe, expect, it } from '@jest/globals';
import { type Pool } from 'pg';

import { createPool } from './pool';

// Runs against the test run's PostgreSQL (test/global-setup.ts provides DATABASE_URL).
describe('createPool', () => {
  let pool: Pool | undefined;

  afterEach(async () => {
    await pool?.end();
  });

  it('applies the configured limits to every session', async () => {
    pool = createPool({
      url: process.env.DATABASE_URL ?? '',
      poolMax: 2,
      connectionTimeoutMs: 1000,
      statementTimeoutMs: 1500,
    });

    const { rows } = await pool.query<Record<string, string>>(
      `select current_setting('statement_timeout') as statement,
              current_setting('idle_in_transaction_session_timeout') as idle,
              current_setting('application_name') as application`,
    );

    expect(rows[0]).toEqual({
      statement: '1500ms',
      idle: '1min',
      application: 'courtly-api',
    });
    expect(pool.options.max).toBe(2);
  });

  it('cancels a statement that runs longer than the statement timeout', async () => {
    pool = createPool({
      url: process.env.DATABASE_URL ?? '',
      poolMax: 1,
      connectionTimeoutMs: 1000,
      statementTimeoutMs: 100,
    });

    await expect(pool.query('select pg_sleep(1)')).rejects.toThrow(/statement timeout/);
  });
});
