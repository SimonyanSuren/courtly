/** One invalid input value, as reported in a validation error. */
export interface FieldError {
  /** Where the value came from: the body, the query string or a route parameter. */
  readonly in: 'body' | 'query' | 'param' | 'custom';
  /** Dot path to the value, e.g. `openingHours.close`; empty for the whole input. */
  readonly path: string;
  readonly message: string;
}

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
