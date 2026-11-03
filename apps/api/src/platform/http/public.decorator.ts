import { type CustomDecorator, SetMetadata } from '@nestjs/common';

/** Metadata key under which `@Public()` marks a route; the authentication guard reads it. */
export const PUBLIC_ROUTE = 'isPublic';

/**
 * Lets a route, or every route of a controller, answer without a logged-in user. Every other
 * route requires one. It lives here, not in the auth module, because technical routes such as the
 * health check need it too, and platform code never imports business modules.
 */
export function Public(): CustomDecorator {
  return SetMetadata(PUBLIC_ROUTE, true);
}
