import { z } from 'zod';

export const loginSchema = z.object({
  // Not checked as an email address: a malformed one simply matches no account and gets the same
  // 401 as any other wrong login. Lower-cased, as stored.
  email: z
    .string({ error: 'Enter your email.' })
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email.')
    .max(254, 'Use at most 254 characters.'),
  // Never trimmed: spaces can be part of a password. The cap bounds the work one request causes.
  password: z
    .string({ error: 'Enter your password.' })
    .min(1, 'Enter your password.')
    .max(1024, 'Use at most 1024 characters.'),
});

export type LoginDto = z.output<typeof loginSchema>;
