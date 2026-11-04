import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { readCookie } from '../../../platform/http/cookies';
import { HttpError } from '../../../platform/http/http.errors';
import { isPublicRoute } from '../../../platform/http/public.decorator';
import { type AuthConfig, authConfig } from '../auth.config';
import { AuthService } from '../auth.service';
import { type AuthenticatedRequest } from '../decorators/current-user.decorator';
import { sessionCookieName } from '../sessions/session-cookie';

/**
 * Runs before every route (registered as APP_GUARD) and denies by default: a route answers only
 * with a valid session, unless it is marked @Public(). A route added without thinking about
 * access is therefore closed, not open.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, sessionCookieName(this.config));
    const user = token === undefined ? undefined : await this.auth.authenticate(token);

    if (!user) {
      throw HttpError.unauthorized();
    }

    request.user = user;

    return true;
  }
}
