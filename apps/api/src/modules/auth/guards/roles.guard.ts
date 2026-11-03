import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { isPublicRoute } from '../../../platform/http/public.decorator';
import { type Role } from '../../users/domain/role';
import { AuthError } from '../auth.errors';
import { type AuthenticatedRequest } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';

/**
 * Runs after the authentication guard (both are APP_GUARDs, applied in the order AuthModule lists
 * them) and lets a request through only when the user's role is one the route names.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    // Read by the decorator's key: passed the decorator itself, Nest types the list as always
    // there, but it is undefined when neither the route nor its controller has @Roles().
    const roles = this.reflector.getAllAndOverride<readonly Role[] | undefined>(Roles.KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // A route nobody decided access for is a bug: it fails closed, with a 500 that is logged,
    // instead of opening to every logged-in user.
    if (roles === undefined) {
      throw new Error(
        `${context.getClass().name}.${context.getHandler().name} has neither @Public() nor @Roles().`,
      );
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user || !roles.includes(user.role)) {
      throw AuthError.forbidden();
    }

    return true;
  }
}
