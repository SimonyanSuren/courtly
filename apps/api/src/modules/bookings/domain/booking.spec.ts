import { describe, expect, it } from '@jest/globals';

import { type OpeningHours } from '../../courts/domain/opening-hours';
import { checkBooking } from './booking';

const EIGHT_TO_ELEVEN = { openingHour: 8, closingHour: 23 };
const ALL_DAY = { openingHour: 0, closingHour: 24 };
// Before every date booked below, except the ones in the past on purpose.
const NOW = '2026-01-15T12:00:00+00:00';

// Jest finds no fields on Temporal objects, so it would call any two instants equal. Tests compare
// them as the facility's clock shows them, with the offset that tells repeated times apart.
function lisbon(instant: Temporal.Instant): string {
  return instant.toZonedDateTimeISO('Europe/Lisbon').toString({ timeZoneName: 'never' });
}

/** The booked range as text, or the reason the booking is rejected. */
function book(
  start: string,
  hours: number,
  { court = EIGHT_TO_ELEVEN, now = NOW }: { court?: OpeningHours; now?: string } = {},
): string {
  const result = checkBooking(
    { start: Temporal.Instant.from(start), hours },
    court,
    Temporal.Instant.from(now),
  );

  return result.ok ? `${lisbon(result.range.start)} to ${lisbon(result.range.end)}` : result.reason;
}

describe('checkBooking', () => {
  it('accepts 1 or 2 hours within opening hours and returns the range they hold', () => {
    expect(book('2026-07-16T10:00:00+01:00', 1)).toBe(
      '2026-07-16T10:00:00+01:00 to 2026-07-16T11:00:00+01:00',
    );
    expect(book('2026-07-16T08:00:00+01:00', 2)).toBe(
      '2026-07-16T08:00:00+01:00 to 2026-07-16T10:00:00+01:00',
    );
  });

  it.each([0, 3, 1.5])('rejects a booking of %s hours', (hours) => {
    expect(book('2026-07-16T10:00:00+01:00', hours)).toBe('INVALID_DURATION');
  });

  it.each(['2026-07-16T10:30:00+01:00', '2026-07-16T10:00:00.001+01:00'])(
    'rejects a start that is not on the hour: %s',
    (start) => {
      expect(book(start, 1)).toBe('NOT_ON_THE_HOUR');
    },
  );

  describe('opening hours', () => {
    it('accepts 2 hours that end exactly at closing', () => {
      expect(book('2026-07-16T21:00:00+01:00', 2)).toBe(
        '2026-07-16T21:00:00+01:00 to 2026-07-16T23:00:00+01:00',
      );
    });

    it('rejects 2 hours that run past closing', () => {
      expect(book('2026-07-16T22:00:00+01:00', 2)).toBe('OUTSIDE_OPENING_HOURS');
    });

    it('rejects a start before opening or at closing', () => {
      expect(book('2026-07-16T07:00:00+01:00', 2)).toBe('OUTSIDE_OPENING_HOURS');
      expect(book('2026-07-16T23:00:00+01:00', 1)).toBe('OUTSIDE_OPENING_HOURS');
    });

    it('keeps a booking within its own day, even at a court open all day', () => {
      expect(book('2026-07-16T23:00:00+01:00', 1, { court: ALL_DAY })).toBe(
        '2026-07-16T23:00:00+01:00 to 2026-07-17T00:00:00+01:00',
      );
      expect(book('2026-07-16T23:00:00+01:00', 2, { court: ALL_DAY })).toBe(
        'OUTSIDE_OPENING_HOURS',
      );
    });
  });

  describe('the time now', () => {
    const start = '2026-07-16T10:00:00+01:00';

    it('rejects a start equal to now: the booking would already have started', () => {
      expect(book(start, 1, { now: start })).toBe('ALREADY_STARTED');
    });

    it('accepts a start 1 ms after now', () => {
      expect(book(start, 1, { now: '2026-07-16T09:59:59.999+01:00' })).toBe(
        '2026-07-16T10:00:00+01:00 to 2026-07-16T11:00:00+01:00',
      );
    });

    it('rejects a start in the past', () => {
      expect(book('2026-01-14T10:00:00+00:00', 1)).toBe('ALREADY_STARTED');
    });
  });

  describe('the days the clocks change', () => {
    it('books real hours across the jump from 01:00 to 02:00', () => {
      expect(book('2026-03-29T00:00:00+00:00', 2, { court: ALL_DAY })).toBe(
        '2026-03-29T00:00:00+00:00 to 2026-03-29T03:00:00+01:00',
      );
    });

    it('books either 01:00 when the clock goes back from 02:00 to 01:00', () => {
      expect(book('2026-10-25T01:00:00+01:00', 2, { court: ALL_DAY })).toBe(
        '2026-10-25T01:00:00+01:00 to 2026-10-25T02:00:00+00:00',
      );
      expect(book('2026-10-25T01:00:00+00:00', 1, { court: ALL_DAY })).toBe(
        '2026-10-25T01:00:00+00:00 to 2026-10-25T02:00:00+00:00',
      );
    });
  });

  it('reports the first broken rule: duration, start on the hour, opening hours, then now', () => {
    // In the past and before opening, too.
    expect(book('2026-01-14T07:30:00+00:00', 3)).toBe('INVALID_DURATION');
    expect(book('2026-01-14T07:30:00+00:00', 1)).toBe('NOT_ON_THE_HOUR');
    expect(book('2026-01-14T07:00:00+00:00', 1)).toBe('OUTSIDE_OPENING_HOURS');
  });
});
