import { HttpStatus } from '@nestjs/common';

import { ApiError } from '../../platform/http/api-error';

/**
 * Every error the auth module answers with: its status, its stable code and the sentence a user
 * reads, in one place. Functions, so each throw gets a new error with its own stack trace.
 */
export const AuthError = {
  invalidCredentials: (): ApiError =>
    new ApiError(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'The email or password is not correct.',
    ),
  unauthorized: (): ApiError =>
    new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Log in to continue.'),
  forbidden: (): ApiError =>
    new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Your account does not have access to this.'),
  tooManyLoginAttempts: (minutes: number): ApiError =>
    new ApiError(
      HttpStatus.TOO_MANY_REQUESTS,
      'TOO_MANY_LOGIN_ATTEMPTS',
      `Too many login attempts. Try again in ${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    ),
};
