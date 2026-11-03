import { z } from 'zod';

/**
 * A moment in ISO 8601 with an offset or Z, as a Temporal.Instant. Temporal refuses a few strings
 * Zod's format allows, such as more than 9 decimals; those become a 400 too, not a failed request.
 */
const instant = z.iso.datetime({ offset: true }).transform((value, context) => {
  try {
    return Temporal.Instant.from(value);
  } catch {
    context.issues.push({ code: 'custom', input: value, message: 'Invalid ISO datetime' });

    return z.NEVER;
  }
});

export const newBookingSchema = z.object({
  courtId: z.uuid(),
  // Any offset: whether it is on the hour is checked on the facility's clock, with the rules.
  startsAt: instant,
  hours: z.literal([1, 2]),
});

export type NewBookingDto = z.output<typeof newBookingSchema>;
