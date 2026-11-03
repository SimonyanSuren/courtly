import { HttpStatus } from '@nestjs/common';

import { ApiError } from '../../platform/http/api-error';

/**
 * Every error the courts module answers with: its status, its stable code and the sentence a user
 * reads, in one place. Functions, so each throw gets a new error with its own stack trace.
 */
export const CourtError = {
  /** For an unknown id, and for an inactive court asked for by a user. */
  notFound: (): ApiError =>
    new ApiError(HttpStatus.NOT_FOUND, 'COURT_NOT_FOUND', 'There is no such court.'),
  nameTaken: (): ApiError =>
    new ApiError(HttpStatus.CONFLICT, 'COURT_NAME_TAKEN', 'Another court already has this name.'),
  /** Reported at the closing hour, the field the web form shows it next to. */
  closesBeforeOpening: (): ApiError =>
    new ApiError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'The court must open before it closes.',
      [{ in: 'body', path: 'closingHour', message: 'Must be after the opening hour.' }],
    ),
};
