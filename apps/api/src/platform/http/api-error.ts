import { z } from 'zod';

/** One invalid input value, as reported in a validation error. */
export const fieldErrorSchema = z.object({
  // `custom` would be a parameter decorator of our own validated with a schema; no route has one.
  in: z.enum(['body', 'query', 'param', 'custom']).meta({
    description: 'Where the value came from: the body, the query string or a route parameter.',
  }),
  path: z.string().meta({
    description: 'Dot path to the value, e.g. `closingHour`; empty for the whole input.',
  }),
  message: z.string(),
});

export type FieldError = Readonly<z.output<typeof fieldErrorSchema>>;

/**
 * An error the API reports on purpose. ProblemDetailsFilter turns it into the response: `status`
 * becomes the HTTP status, `code` the stable identifier clients branch on, the message the detail.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: readonly FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
