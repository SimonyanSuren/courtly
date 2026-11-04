import { z } from 'zod';

import { type Court } from '../courts.schema';
import { newCourtSchema } from './new-court.dto';

/*
 * What the courts routes send, for the API reference and the types. Nothing parses a response:
 * the routes return values the database and the rules already checked.
 */

/**
 * A court as the database's Court type describes it, field for field. `satisfies` rejects a schema
 * that lacks one of Court's fields or allows a value Court does not; the routes, which return a
 * Court as a CourtResponse, reject a schema with a field Court lacks.
 */
export const courtSchema = z
  .object({ id: z.uuid(), ...newCourtSchema.shape, active: z.boolean() })
  .meta({ id: 'Court' }) satisfies z.ZodType<Court>;

export type CourtResponse = z.output<typeof courtSchema>;
