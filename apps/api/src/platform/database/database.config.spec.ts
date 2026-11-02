import { afterEach, describe, expect, it } from '@jest/globals';

import { databaseConfig } from './database.config';

const url = 'postgres://courtly:courtly@localhost/courtly';

describe('databaseConfig', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  function withEnv(env: Record<string, string | undefined>): void {
    process.env = { ...originalEnv, DATABASE_URL: url, ...env };
  }

  it('reads the URL and applies the pool defaults', () => {
    withEnv({
      DATABASE_POOL_MAX: undefined,
      DATABASE_CONNECTION_TIMEOUT_MS: undefined,
      DATABASE_STATEMENT_TIMEOUT_MS: undefined,
    });

    expect(databaseConfig()).toEqual({
      url,
      poolMax: 10,
      connectionTimeoutMs: 5000,
      statementTimeoutMs: 10_000,
    });
  });

  it('reads the pool settings as numbers', () => {
    withEnv({
      DATABASE_POOL_MAX: '20',
      DATABASE_CONNECTION_TIMEOUT_MS: '2000',
      DATABASE_STATEMENT_TIMEOUT_MS: '30000',
    });

    expect(databaseConfig()).toMatchObject({
      poolMax: 20,
      connectionTimeoutMs: 2000,
      statementTimeoutMs: 30_000,
    });
  });

  it.each([undefined, 'not a url', 'mysql://localhost/courtly'])(
    'rejects DATABASE_URL=%j',
    (value) => {
      withEnv({ DATABASE_URL: value });

      expect(() => databaseConfig()).toThrow(/DATABASE_URL/);
    },
  );

  it.each([
    ['DATABASE_POOL_MAX', '0'],
    ['DATABASE_CONNECTION_TIMEOUT_MS', '-1'],
    ['DATABASE_STATEMENT_TIMEOUT_MS', '1.5'],
  ])('rejects %s=%j', (name, value) => {
    withEnv({ [name]: value });

    expect(() => databaseConfig()).toThrow(name);
  });
});
