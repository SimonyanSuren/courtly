import { type ConfigType } from '@nestjs/config';
import { z } from 'zod';

import { defineConfig } from '../../platform/config/config';

/** How long a session lasts and how its cookie is sent. */
export const authConfig = defineConfig(
  'auth',
  z.object({
    // A session ends this many days after login, active or not; logging out ends it sooner.
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    // Browsers send a Secure cookie over HTTPS only. Set to false to serve over plain HTTP, as the
    // local Docker setup does on localhost.
    SESSION_COOKIE_SECURE: z.stringbool().default(true),
  }),
  (env) => ({
    sessionTtlDays: env.SESSION_TTL_DAYS,
    cookieSecure: env.SESSION_COOKIE_SECURE,
  }),
);

export type AuthConfig = ConfigType<typeof authConfig>;
