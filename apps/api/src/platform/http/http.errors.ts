import { HttpStatus } from '@nestjs/common';

import { ApiError, type FieldError } from './api-error';

/**
 * The errors any route can answer with, whatever its module: invalid values, which the schema pipe
 * reports, and a missing session, which every route but the @Public() ones needs. Functions, as in
 * each module's errors file, so each throw gets a new error with its own stack trace.
 */
export const HttpError = {
  /** A route names it in the API reference with an example of its own fields. */
  validationFailed: (errors: readonly FieldError[]): ApiError =>
    new ApiError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'The request has invalid values.',
      errors,
    ),
  unauthorized: (): ApiError =>
    new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Log in to continue.'),
};
