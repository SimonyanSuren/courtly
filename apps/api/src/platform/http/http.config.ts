import { type ConfigType } from '@nestjs/config';
import { z } from 'zod';

import { defineConfig } from '../config/config';

/** Settings of the HTTP server. */
export const httpConfig = defineConfig(
  'http',
  z.object({
    // Environment variables are strings; coerce turns "8080" into 8080 before the checks.
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    // How many reverse proxies stand between clients and the API. Their X-Forwarded-For entries
    // then give the client's address, which the login limit counts. 0 when clients connect
    // directly: any client can send that header, so it is ignored.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  }),
  (env) => ({ port: env.PORT, trustProxyHops: env.TRUST_PROXY_HOPS }),
);

export type HttpConfig = ConfigType<typeof httpConfig>;
