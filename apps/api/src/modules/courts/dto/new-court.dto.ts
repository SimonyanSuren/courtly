import { z } from 'zod';

import { MAX_COURT_NAME_LENGTH, MAX_HOURLY_PRICE_CENTS, Sport } from '../domain/court';

// Each hour on its own. Whether the court opens before it closes is checked on the pair, by the
// service, because a change may send only one of them.
const hour = z.number().int().min(0).max(24);

export const newCourtSchema = z.object({
  // Trimmed, as stored, so the unique name ignores spaces around it.
  name: z.string().trim().min(1).max(MAX_COURT_NAME_LENGTH),
  sport: z.enum(Sport),
  // Whole cents: 1500 is €15.00.
  hourlyPriceCents: z.number().int().positive().max(MAX_HOURLY_PRICE_CENTS),
  openingHour: hour,
  closingHour: hour,
});

export type NewCourtDto = z.output<typeof newCourtSchema>;
