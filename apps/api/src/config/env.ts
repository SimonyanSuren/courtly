import { z } from 'zod';

// Every environment variable the API reads. ConfigModule validates them once at startup, so a
// missing or invalid value stops the start instead of failing later, at first use.
export const envSchema = z.object({
  // Environment variables are strings; coerce turns "8080" into 8080 before the checks.
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type Env = z.infer<typeof envSchema>;
