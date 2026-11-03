import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';

/** PostgreSQL's SQLSTATE for a unique violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether a query failed because it broke this unique constraint or unique index. Drizzle wraps
 * every failed query in a DrizzleQueryError; the driver's error, its cause, carries PostgreSQL's
 * code and the constraint's name.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof DrizzleQueryError &&
    error.cause instanceof DatabaseError &&
    error.cause.code === UNIQUE_VIOLATION &&
    error.cause.constraint === constraint
  );
}
