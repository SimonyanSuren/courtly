import { type CustomDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';

/** Metadata key under which `@Public()` marks a route. */
const PUBLIC_ROUTE = 'isPublic';

/**
 * Lets a route, or every route of a controller, answer without a logged-in user. Every other
 * route requires one. It lives here, not in the auth module, because technical routes such as the
 * health check need it too, and platform code never imports business modules.
 */
export function Public(): CustomDecorator {
  return SetMetadata(PUBLIC_ROUTE, true);
}

/** Whether the route being handled, or its controller, is marked `@Public()`. For guards. */
export function isPublicRoute(reflector: Reflector, context: ExecutionContext): boolean {
  return (
    reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}
