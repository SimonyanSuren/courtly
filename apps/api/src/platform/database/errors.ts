import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';

/** PostgreSQL's SQLSTATE for a unique violation. */
const UNIQUE_VIOLATION = '23505';

/** PostgreSQL's SQLSTATE for an exclusion violation. */
const EXCLUSION_VIOLATION = '23P01';

/**
 * Drizzle wraps every failed query in a DrizzleQueryError; the driver's error, its cause, carries
 * PostgreSQL's code and the constraint's name.
 */
function isViolation(error: unknown, code: string, constraint: string): boolean {
  return (
    error instanceof DrizzleQueryError &&
    error.cause instanceof DatabaseError &&
    error.cause.code === code &&
    error.cause.constraint === constraint
  );
}

/** Whether a query failed because it broke this unique constraint or unique index. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return isViolation(error, UNIQUE_VIOLATION, constraint);
}

/**
 * Whether a query failed because it broke this exclusion constraint: the row conflicts with one
 * the table already holds, or one another transaction has just committed.
 */
export function isExclusionViolation(error: unknown, constraint: string): boolean {
  return isViolation(error, EXCLUSION_VIOLATION, constraint);
}
