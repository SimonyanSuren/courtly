import { z } from 'zod';

import { defineConfig } from '../config/config';

/** Settings of the HTTP server. */
export const httpConfig = defineConfig(
  'http',
  z.object({
    // Environment variables are strings; coerce turns "8080" into 8080 before the checks.
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  }),
  (env) => ({ port: env.PORT }),
);
