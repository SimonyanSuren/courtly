import { Reflector } from '@nestjs/core';

import { type Role } from '../../users/users.schema';

/**
 * The roles that may use a route, or every route of a controller: `@Roles(['admin'])`. A route's
 * own list replaces its controller's. Every route that is not `@Public()` needs one; the roles
 * guard refuses a route without it.
 */
export const Roles = Reflector.createDecorator<readonly Role[]>();
