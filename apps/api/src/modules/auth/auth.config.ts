import { type ConfigType } from '@nestjs/config';
import { z } from 'zod';

import { defineConfig } from '../../platform/config/config';

/** How long a session lasts, how its cookie is sent and how often login may be tried. */
export const authConfig = defineConfig(
  'auth',
  z.object({
    // A session ends this many days after login, active or not; logging out ends it sooner.
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    // Browsers send a Secure cookie over HTTPS only. Set to false to serve over plain HTTP, as the
    // local Docker setup does on localhost.
    SESSION_COOKIE_SECURE: z.stringbool().default(true),
    // Login attempts allowed per 15 minutes from one client address, and for one email from any
    // address. The first limits one client trying many accounts, the second many clients
    // guessing one password.
    LOGIN_ATTEMPTS_PER_IP: z.coerce.number().int().min(1).default(50),
    LOGIN_ATTEMPTS_PER_EMAIL: z.coerce.number().int().min(1).default(10),
  }),
  (env) => ({
    sessionTtlDays: env.SESSION_TTL_DAYS,
    cookieSecure: env.SESSION_COOKIE_SECURE,
    loginAttemptsPerIp: env.LOGIN_ATTEMPTS_PER_IP,
    loginAttemptsPerEmail: env.LOGIN_ATTEMPTS_PER_EMAIL,
  }),
);

export type AuthConfig = ConfigType<typeof authConfig>;
