import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'admin']);

/** People who can log in. Accounts are seeded: there is no sign-up. */
export const users = pgTable(
  'users',
  {
    // uuidv7() (PostgreSQL 18) starts with a timestamp, so new ids go to the end of the index
    // instead of random pages. As a UUID, an id in a URL does not reveal how many users exist.
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: userRole('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Emails are stored lower-case, so the unique constraint also rejects the same address
    // written with different capitals.
    check('users_email_lower_case', sql`${table.email} = lower(${table.email})`),
  ],
);

export type User = typeof users.$inferSelect;

export type Role = User['role'];

/** What the API shows of a user: never the password hash. */
export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'role'>;
