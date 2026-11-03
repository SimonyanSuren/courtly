import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { PasswordHasher } from './password-hasher';
import { SessionsRepository } from './sessions/sessions.repository';

/** Login, logout and sessions. Its guard protects every route of the API. */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsRepository,
    PasswordHasher,
    // A global guard: it runs before every route in every module, not only this module's.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
