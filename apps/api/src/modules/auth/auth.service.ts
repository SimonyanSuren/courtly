import { Inject, Injectable } from '@nestjs/common';

import { UsersRepository } from '../users/users.repository';
import { type PublicUser } from '../users/users.schema';
import { type AuthConfig, authConfig } from './auth.config';
import { AuthError } from './auth.errors';
import { PasswordHasher } from './password-hasher';
import { createSessionToken, hashSessionToken } from './sessions/session-token';
import { SessionsRepository } from './sessions/sessions.repository';

const MILLISECONDS_PER_DAY = 86_400_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly passwords: PasswordHasher,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  /**
   * Checks the credentials and starts a session; returns its token, for the cookie, and the user.
   * The same error answers an unknown email and a wrong password, after the same amount of work.
   * `previousToken`, a session this browser already had, ends: a login always gets a new token,
   * so a token planted in the browser beforehand (session fixation) is never logged in.
   */
  async login(
    email: string,
    password: string,
    previousToken?: string,
  ): Promise<{ token: string; user: PublicUser }> {
    const user = await this.users.findByEmail(email);
    const isPasswordCorrect = await this.passwords.verify(password, user?.passwordHash);

    if (!user || !isPasswordCorrect) {
      throw AuthError.invalidCredentials();
    }

    if (previousToken !== undefined) {
      await this.logout(previousToken);
    }

    await this.sessions.deleteExpired(user.id);

    const { token, tokenHash } = createSessionToken();
    await this.sessions.create({
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + this.config.sessionTtlDays * MILLISECONDS_PER_DAY),
    });

    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.delete(hashSessionToken(token));
  }

  /** The user whose unexpired session this token belongs to, if any. */
  async authenticate(token: string): Promise<PublicUser | undefined> {
    return this.sessions.findUser(hashSessionToken(token));
  }
}
