import { type CookieSerializeOptions } from '@nestjs/common';

import { type AuthConfig } from '../auth.config';

const SECONDS_PER_DAY = 86_400;

/**
 * The `__Host-` prefix makes browsers accept the cookie only when it is Secure, has no Domain and
 * has the path /, so a neighbouring subdomain cannot plant a session of its own. The prefix needs
 * Secure, so a cookie sent over plain HTTP keeps a plain name.
 */
export function sessionCookieName(config: AuthConfig): string {
  return config.cookieSecure ? '__Host-session' : 'session';
}

export function sessionCookieOptions(config: AuthConfig): CookieSerializeOptions {
  return {
    // Hidden from JavaScript, so a script injected into the page cannot steal the session.
    httpOnly: true,
    secure: config.cookieSecure,
    // Not sent on cross-site subrequests such as a form another site submits. Lax rather than
    // Strict keeps the user logged in when they follow a link to Courtly from elsewhere; the
    // cross-origin check on state-changing requests covers the rest.
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTtlDays * SECONDS_PER_DAY,
  };
}
