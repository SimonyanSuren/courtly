import {
  Body,
  Controller,
  Cookies,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { ApiRoute } from '../../platform/api-docs/api-route.decorator';
import { HttpError } from '../../platform/http/http.errors';
import { Public } from '../../platform/http/public.decorator';
import { Role } from '../users/domain/role';
import { type UserResponse, userSchema } from '../users/dto/user.response';
import { type PublicUser } from '../users/users.schema';
import { type AuthConfig, authConfig } from './auth.config';
import { AuthError } from './auth.errors';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { type LoginDto, loginSchema } from './dto/login.dto';
import { LOGIN_WINDOW_MINUTES, LoginThrottleGuard } from './guards/login-throttle.guard';
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
  // Counts every attempt before the body is validated or the password checked.
  @UseGuards(LoginThrottleGuard)
  @ApiRoute({
    summary: 'Log in (public)',
    response: userSchema,
    description: 'The user; the session cookie is set.',
    errors: [
      HttpError.validationFailed([
        { in: 'body', path: 'password', message: 'Enter your password.' },
      ]),
      AuthError.invalidCredentials(),
      AuthError.tooManyLoginAttempts(LOGIN_WINDOW_MINUTES),
    ],
    isPublic: true,
  })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) { email, password }: LoginDto,
    @Cookies() cookies: Record<string, string | undefined>,
    // passthrough: Nest still sends the returned body; the response is only for the cookie.
    @Res({ passthrough: true }) response: unknown,
  ): Promise<UserResponse> {
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
  @ApiRoute({
    summary: 'Log out (public)',
    status: HttpStatus.NO_CONTENT,
    description: 'The session ends and the cookie clears.',
    isPublic: true,
  })
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

  @Roles([Role.USER, Role.ADMIN])
  @ApiRoute({
    summary: 'The logged-in user (any role)',
    response: userSchema,
    description: 'The user the session belongs to.',
  })
  @Get('me')
  me(@CurrentUser() user: PublicUser): UserResponse {
    return user;
  }
}
