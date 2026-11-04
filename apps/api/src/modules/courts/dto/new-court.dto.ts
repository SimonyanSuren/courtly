import { z } from 'zod';

import { MAX_COURT_NAME_LENGTH, MAX_HOURLY_PRICE_CENTS, Sport } from '../domain/court';

// Messages are shown to the admin next to the field, so they are sentences, and money is in
// euros as the form shows it: Zod's defaults would say "expected number to be <=100000", in cents.
const euros = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });
const HOUR_MESSAGE = 'Must be a whole hour from 0 to 24.';
const PRICE_TYPE_MESSAGE = 'Must be a whole number of cents.';

// Each hour on its own. Whether the court opens before it closes is checked on the pair, by the
// service, because a change may send only one of them.
const hour = z
  .number({ error: HOUR_MESSAGE })
  .int(HOUR_MESSAGE)
  .min(0, HOUR_MESSAGE)
  .max(24, HOUR_MESSAGE);

export const newCourtSchema = z.object({
  // Trimmed, as stored, so the unique name ignores spaces around it.
  name: z
    .string({ error: 'Enter a name.' })
    .trim()
    .min(1, 'Enter a name.')
    .max(MAX_COURT_NAME_LENGTH, `Use at most ${String(MAX_COURT_NAME_LENGTH)} characters.`),
  sport: z.enum(Sport, { error: `Must be one of: ${Object.values(Sport).join(', ')}.` }),
  // Whole cents: 1500 is €15.00.
  hourlyPriceCents: z
    .number({ error: PRICE_TYPE_MESSAGE })
    .int(PRICE_TYPE_MESSAGE)
    .positive(`Must be more than ${euros.format(0)}.`)
    .max(
      MAX_HOURLY_PRICE_CENTS,
      `Must be at most ${euros.format(MAX_HOURLY_PRICE_CENTS / 100)} an hour.`,
    ),
  openingHour: hour,
  closingHour: hour,
});

export type NewCourtDto = z.output<typeof newCourtSchema>;
