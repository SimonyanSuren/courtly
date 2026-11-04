import { z } from 'zod';

import { Role } from '../domain/role';
import { type PublicUser } from '../users.schema';

/**
 * A user as the API shows one, for the API reference and the types: the database's PublicUser,
 * field for field. `satisfies` rejects a schema that lacks one of its fields or allows a value it
 * does not; the routes, which return a PublicUser as a UserResponse, reject one with a field
 * PublicUser lacks. Nothing parses a response.
 */
export const userSchema = z
  .object({ id: z.uuid(), email: z.string(), name: z.string(), role: z.enum(Role) })
  .meta({ id: 'User' }) satisfies z.ZodType<PublicUser>;

export type UserResponse = z.output<typeof userSchema>;
