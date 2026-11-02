import { describe, expect, it } from '@jest/globals';

import { isValidOpeningHours, openingTimes } from './opening-hours';

const SPRING_FORWARD = Temporal.PlainDate.from('2026-03-29');
const FALL_BACK = Temporal.PlainDate.from('2026-10-25');

// Jest finds no fields on Temporal objects, so it would call any two instants equal. Tests compare
// them as the facility's clock shows them, with the offset that tells repeated times apart.
function lisbon(instant: Temporal.Instant): string {
  return instant.toZonedDateTimeISO('Europe/Lisbon').toString({ timeZoneName: 'never' });
}

function lisbonOpeningTimes(
  openingHour: number,
  closingHour: number,
  date: Temporal.PlainDate,
): { opens: string; closes: string } {
  const { opens, closes } = openingTimes({ openingHour, closingHour }, date);

  return { opens: lisbon(opens), closes: lisbon(closes) };
}

describe('the days Lisbon changes its clocks in 2026 (premises of these tests)', () => {
  it.each([
    { date: '2026-03-29', hours: 23, utc: '2026-03-29T01:00:00Z', after: '02:00:00+01:00' },
    { date: '2026-10-25', hours: 25, utc: '2026-10-25T01:00:00Z', after: '01:00:00+00:00' },
  ])('$date lasts $hours hours; at $utc the clock shows $after', ({ date, hours, utc, after }) => {
    const startOfDay = Temporal.PlainDate.from(date).toZonedDateTime('Europe/Lisbon');
    const change = startOfDay.getTimeZoneTransition('next');

    expect(startOfDay.hoursInDay).toBe(hours);
    expect(change?.toInstant().toString()).toBe(utc);
    expect(change?.toString({ timeZoneName: 'never' })).toBe(`${date}T${after}`);
  });
});

describe('isValidOpeningHours', () => {
  it.each([
    { openingHour: 8, closingHour: 23 },
    { openingHour: 0, closingHour: 24 },
    { openingHour: 23, closingHour: 24 },
  ])('accepts $openingHour to $closingHour', (hours) => {
    expect(isValidOpeningHours(hours)).toBe(true);
  });

  it.each([
    { openingHour: 8, closingHour: 8, problem: 'closing when it opens' },
    { openingHour: 23, closingHour: 8, problem: 'closing before it opens' },
    { openingHour: 8.5, closingHour: 23, problem: 'opening at no whole hour' },
    { openingHour: 8, closingHour: 22.5, problem: 'closing at no whole hour' },
    { openingHour: -1, closingHour: 23, problem: 'opening before 00:00' },
    { openingHour: 8, closingHour: 25, problem: 'closing after 24:00' },
  ])('rejects $openingHour to $closingHour: $problem', ({ openingHour, closingHour }) => {
    expect(isValidOpeningHours({ openingHour, closingHour })).toBe(false);
  });
});

describe('openingTimes', () => {
  it('reads the hours on the facility clock of that date', () => {
    expect(lisbonOpeningTimes(8, 23, Temporal.PlainDate.from('2026-01-15'))).toEqual({
      opens: '2026-01-15T08:00:00+00:00',
      closes: '2026-01-15T23:00:00+00:00',
    });
    expect(lisbonOpeningTimes(8, 23, Temporal.PlainDate.from('2026-07-15'))).toEqual({
      opens: '2026-07-15T08:00:00+01:00',
      closes: '2026-07-15T23:00:00+01:00',
    });
  });

  it('closes at 24 at the midnight that starts the next day', () => {
    expect(lisbonOpeningTimes(0, 24, Temporal.PlainDate.from('2026-07-15'))).toEqual({
      opens: '2026-07-15T00:00:00+01:00',
      closes: '2026-07-16T00:00:00+01:00',
    });
  });

  // On 2026-03-29 the clock jumps from 01:00 to 02:00: 01:00 never shows.
  it('opens or closes at a skipped hour when the clock jumps past it', () => {
    expect(lisbonOpeningTimes(1, 3, SPRING_FORWARD).opens).toBe('2026-03-29T02:00:00+01:00');
    expect(lisbonOpeningTimes(0, 1, SPRING_FORWARD).closes).toBe('2026-03-29T02:00:00+01:00');
  });

  // On 2026-10-25 the clock goes from 02:00 back to 01:00: 01:00 shows twice.
  it('opens or closes at a repeated hour the first time the clock shows it', () => {
    expect(lisbonOpeningTimes(1, 3, FALL_BACK).opens).toBe('2026-10-25T01:00:00+01:00');
    expect(lisbonOpeningTimes(0, 1, FALL_BACK).closes).toBe('2026-10-25T01:00:00+01:00');
  });
});
