import { Body, Controller, Cookies, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { Public } from '../../platform/http/public.decorator';
import { type PublicUser } from '../users/users.schema';
import { type AuthConfig, authConfig } from './auth.config';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { type LoginDto, loginSchema } from './dto/login.dto';
import { sessionCookieName, sessionCookieOptions } from './sessions/session-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly adapterHost: HttpAdapterHost,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  /** Starts a session: the token goes into the httpOnly cookie, the user into the body. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) { email, password }: LoginDto,
    @Cookies() cookies: Record<string, string | undefined>,
    // passthrough: Nest still sends the returned body; the response is only for the cookie.
    @Res({ passthrough: true }) response: unknown,
  ): Promise<PublicUser> {
    const name = sessionCookieName(this.config);
    const { token, user } = await this.auth.login(email, password, cookies[name]);
    this.adapterHost.httpAdapter.setCookie(
      response,
      name,
      token,
      sessionCookieOptions(this.config),
    );

    return user;
  }

  /**
   * Ends the session and clears the cookie. Public, so it also clears the cookie of a session
   * that has already expired; without a session it only clears the cookie.
   */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Cookies() cookies: Record<string, string | undefined>,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<void> {
    const name = sessionCookieName(this.config);
    const token = cookies[name];

    // Only whether the cookie was sent; no secret is compared here.
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token !== undefined) {
      await this.auth.logout(token);
    }

    // The attributes must match the ones the cookie was set with, or the browser keeps it.
    this.adapterHost.httpAdapter.clearCookie(response, name, sessionCookieOptions(this.config));
  }

  @Roles(['user', 'admin'])
  @Get('me')
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
