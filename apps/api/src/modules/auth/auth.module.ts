import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { UsersModule } from '../users/users.module';
import { authConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { loginThrottlerOptions } from './guards/login-throttle.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasswordHasher } from './password-hasher';
import { SessionsRepository } from './sessions/sessions.repository';

/** Login, logout, sessions and roles. Its guards protect every route of the API. */
@Module({
  imports: [
    UsersModule,
    // Only the login route uses its guard; the options come from the auth configuration.
    ThrottlerModule.forRootAsync({ inject: [authConfig.KEY], useFactory: loginThrottlerOptions }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsRepository,
    PasswordHasher,
    // Global guards: they run before every route in every module, not only this module's, in
    // this order. Who the user is comes first (401), then whether their role may (403).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
