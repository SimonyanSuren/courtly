import { type ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';

import { ApiError } from '../../../platform/http/api-error';
import { type AuthConfig } from '../auth.config';
import { loginSchema } from '../dto/login.dto';

const WINDOW_MILLISECONDS = 15 * 60 * 1000;
const SECONDS_PER_MINUTE = 60;

const emailOnly = loginSchema.pick({ email: true });

/**
 * The email a login is for, as login compares it: trimmed and lower-case, so changing the case
 * does not reset the count. The body is already parsed; it is not validated yet.
 */
function loginEmail(request: { body?: unknown }): string {
  const result = emailOnly.safeParse(request.body);

  return result.success ? result.data.email : '';
}

/**
 * Two counters for each login attempt, successful or not: one per client address (request.ip, an
 * IPv6 address counted by its /64 network) and one per email. Kept in memory, so they reset on a
 * restart and each instance of the API counts on its own.
 */
export function loginThrottlerOptions(config: AuthConfig): ThrottlerModuleOptions {
  return {
    // The rate-limit headers would tell an attacker how many tries remain; only Retry-After is
    // sent, with the 429.
    setHeaders: false,
    throttlers: [
      { name: 'ip', ttl: WINDOW_MILLISECONDS, limit: config.loginAttemptsPerIp },
      {
        name: 'email',
        ttl: WINDOW_MILLISECONDS,
        limit: config.loginAttemptsPerEmail,
        getTracker: loginEmail,
      },
    ],
  };
}

/**
 * Nest's throttler guard, answering in this API's terms: a 429 with a sentence a user can read
 * and the standard Retry-After header (Nest would send `Retry-After-ip` or `Retry-After-email`).
 */
@Injectable()
export class LoginThrottleGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    context: ExecutionContext,
    { timeToBlockExpire }: ThrottlerLimitDetail,
  ): Promise<void> {
    // Seconds until the block ends; whole minutes for the message.
    this.setResponseHeader(this.getRequestResponse(context).res, 'Retry-After', timeToBlockExpire);
    const minutes = Math.ceil(timeToBlockExpire / SECONDS_PER_MINUTE);

    return Promise.reject(
      new ApiError(
        429,
        'TOO_MANY_LOGIN_ATTEMPTS',
        `Too many login attempts. Try again in ${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}.`,
      ),
    );
  }
}
