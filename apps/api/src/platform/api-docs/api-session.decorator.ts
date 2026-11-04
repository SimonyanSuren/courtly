import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';

import { HttpError } from '../http/http.errors';
import { ApiErrors } from './api-errors.decorator';

/** The security scheme of the routes that need a session, as the reference names it. */
export const SESSION_SECURITY = 'session';

/**
 * Documents a route as the authentication guard treats each one that is not @Public(): it needs
 * the session cookie, and answers 401 without it.
 */
export function ApiSession(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiCookieAuth(SESSION_SECURITY), ApiErrors(HttpError.unauthorized()));
}
