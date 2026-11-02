import { type ConfigType } from '@nestjs/config';
import { z } from 'zod';

import { defineConfig } from '../config/config';

const milliseconds = z.coerce.number().int().min(1);

/** Settings of the PostgreSQL connection pool. */
export const databaseConfig = defineConfig(
  'database',
  z.object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Every API instance opens up to this many connections; instances × pool size must stay below
    // the server's max_connections (100 by default).
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
    DATABASE_CONNECTION_TIMEOUT_MS: milliseconds.default(5000),
    DATABASE_STATEMENT_TIMEOUT_MS: milliseconds.default(10_000),
  }),
  (env) => ({
    url: env.DATABASE_URL,
    poolMax: env.DATABASE_POOL_MAX,
    connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS,
    statementTimeoutMs: env.DATABASE_STATEMENT_TIMEOUT_MS,
  }),
);

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
