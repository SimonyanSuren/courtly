import { describe, expect, it } from '@jest/globals';
import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';

import { isUniqueViolation } from './errors';

/** A failed query as Drizzle reports it: the driver's error with PostgreSQL's fields, wrapped. */
function failedQuery(code: string, constraint: string): DrizzleQueryError {
  const cause = new DatabaseError('the query failed', 0, 'error');
  cause.code = code;
  cause.constraint = constraint;

  return new DrizzleQueryError('insert into "courts" ...', [], cause);
}

describe('isUniqueViolation', () => {
  it('recognises a unique violation of the named constraint', () => {
    expect(
      isUniqueViolation(failedQuery('23505', 'courts_name_unique'), 'courts_name_unique'),
    ).toBe(true);
  });

  it.each([
    { error: failedQuery('23505', 'users_email_unique'), problem: 'another constraint' },
    { error: failedQuery('23514', 'courts_name_unique'), problem: 'a check violation' },
    { error: new Error('connection refused'), problem: 'an error without a query' },
  ])('does not mistake $problem for it', ({ error }) => {
    expect(isUniqueViolation(error, 'courts_name_unique')).toBe(false);
  });
});
