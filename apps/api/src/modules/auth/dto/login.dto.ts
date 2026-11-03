import { z } from 'zod';

export const loginSchema = z.object({
  // Not checked as an email address: a malformed one simply matches no account and gets the same
  // 401 as any other wrong login. Lower-cased, as stored.
  email: z.string().trim().toLowerCase().min(1).max(254),
  // Never trimmed: spaces can be part of a password. The cap bounds the work one request causes.
  password: z.string().min(1).max(1024),
});

export type LoginDto = z.output<typeof loginSchema>;
