import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from '../../users/users.schema';

/** Logged-in browsers. A row is one session; deleting it logs that browser out at once. */
export const sessions = pgTable(
  'sessions',
  {
    // SHA-256 of the token in the cookie, in hex. The token itself is never stored, so someone
    // who reads this table still cannot log in as anyone.
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Login removes a user's expired sessions; PostgreSQL does not index foreign keys by itself.
  (table) => [index('sessions_user_id_index').on(table.userId)],
);
