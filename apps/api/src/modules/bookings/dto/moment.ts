import { z } from 'zod';

import { FACILITY_TIME_ZONE } from '../../courts/domain/opening-hours';

/*
 * Each `*.response.ts` file next to this one holds what one bookings route sends, as documented in
 * docs/api.md: a Zod schema, which gives the API reference and the type, and the function that
 * writes the service's value in it. Nothing parses a response. The service works with Temporal
 * values; only these files know how they are written in JSON.
 */

/** A moment as the API writes it: with the facility's offset, as 2026-11-05T18:00:00+00:00. */
export const moment = z.iso.datetime({ offset: true });

/** A moment as the API writes it: with the facility's offset, as 2026-11-05T18:00:00+00:00. */
export function facilityTime(instant: Temporal.Instant): string {
  return instant.toZonedDateTimeISO(FACILITY_TIME_ZONE).toString({ timeZoneName: 'never' });
}
