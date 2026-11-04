import { z } from 'zod';

import { newCourtSchema } from './new-court.dto';

/** Any of a court's fields; `active: false` deactivates it and `active: true` reactivates it. */
export const courtChangesSchema = newCourtSchema
  .extend({ active: z.boolean({ error: 'Must be true or false.' }) })
  .partial();

export type CourtChangesDto = z.output<typeof courtChangesSchema>;
