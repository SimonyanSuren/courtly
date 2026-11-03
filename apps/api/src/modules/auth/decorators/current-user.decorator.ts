import { type IncomingMessage } from 'node:http';

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { type PublicUser } from '../../users/users.schema';

/** A request that the authentication guard has checked; it adds the logged-in user. */
export interface AuthenticatedRequest extends IncomingMessage {
  user?: PublicUser;
}

/** The logged-in user of the request. Only for routes that are not public. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      // A programming error, not a client one: the route is public or the guard did not run.
      throw new Error('@CurrentUser() is used on a route without a logged-in user.');
    }

    return user;
  },
);
