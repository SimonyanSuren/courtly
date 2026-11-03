import { PasswordHasher } from '../src/modules/auth/password-hasher';
import { type User, users } from '../src/modules/users/users.schema';
import { type Database } from '../src/platform/database/database';

/** The password of every user createUser() makes. */
export const TEST_PASSWORD = 'correct horse battery staple';

const hasher = new PasswordHasher();

/** Inserts a user who logs in with TEST_PASSWORD. */
export async function createUser(
  db: Database,
  fields: Pick<User, 'email'> & Partial<Pick<User, 'name' | 'role'>>,
): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      name: 'Test User',
      role: 'user',
      ...fields,
      passwordHash: await hasher.hash(TEST_PASSWORD),
    })
    .returning();

  if (!user) {
    throw new Error('The insert returned no user.');
  }

  return user;
}
