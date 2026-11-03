import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lte, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../../../platform/database/database';
import { type PublicUser, users } from '../../users/users.schema';
import { sessions } from './sessions.schema';

@Injectable()
export class SessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(session: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  /**
   * The user of an unexpired session. Read on every request, with the user's current role, so a
   * role change applies at once. One primary-key lookup.
   */
  async findUser(tokenHash: string): Promise<PublicUser | undefined> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, sql`now()`)));

    return user;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  /** Removes a user's expired sessions, so the table does not grow with every login. */
  async deleteExpired(userId: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, sql`now()`)));
  }
}
