import { z } from 'zod';

export const dateQuerySchema = z.object({
  // A calendar day in the facility's time zone, such as 2026-11-05. Zod checks that the day
  // exists, so Temporal never refuses it.
  date: z.iso
    .date({ error: 'Must be a date such as 2026-11-05.' })
    .transform((value) => Temporal.PlainDate.from(value)),
});

export type DateQueryDto = z.output<typeof dateQuerySchema>;
