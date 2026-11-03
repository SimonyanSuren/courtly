import { describe, expect, it } from '@jest/globals';
import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';

import { isExclusionViolation, isUniqueViolation } from './errors';

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

describe('isExclusionViolation', () => {
  it('recognises an exclusion violation of the named constraint', () => {
    expect(
      isExclusionViolation(failedQuery('23P01', 'bookings_no_overlap'), 'bookings_no_overlap'),
    ).toBe(true);
  });

  it.each([
    { error: failedQuery('23P01', 'another_exclusion'), problem: 'another constraint' },
    { error: failedQuery('23505', 'bookings_no_overlap'), problem: 'a unique violation' },
    { error: new Error('connection refused'), problem: 'an error without a query' },
  ])('does not mistake $problem for it', ({ error }) => {
    expect(isExclusionViolation(error, 'bookings_no_overlap')).toBe(false);
  });
});
