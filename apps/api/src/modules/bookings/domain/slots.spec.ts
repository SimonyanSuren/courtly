import { describe, expect, it } from '@jest/globals';

import { daySlots, hasStarted } from './slots';

// Jest finds no fields on Temporal objects, so it would call any two instants equal. Tests compare
// them as the facility's clock shows them, with the offset that tells repeated times apart.
function lisbon(instant: Temporal.Instant): string {
  return instant.toZonedDateTimeISO('Europe/Lisbon').toString({ timeZoneName: 'never' });
}

function lisbonSlots(openingHour: number, closingHour: number, date: string): string[] {
  return daySlots({ openingHour, closingHour }, Temporal.PlainDate.from(date)).map(
    ({ start, end }) => `${lisbon(start)} to ${lisbon(end)}`,
  );
}

describe('daySlots', () => {
  it.each([
    { day: 'an ordinary day', date: '2026-07-15', slots: 24 },
    { day: 'the day the clocks go forward', date: '2026-03-29', slots: 23 },
    { day: 'the day the clocks go back', date: '2026-10-25', slots: 25 },
  ])('gives a court open from 0 to 24 $slots slots on $day', ({ date, slots }) => {
    expect(lisbonSlots(0, 24, date)).toHaveLength(slots);
  });

  it.each(['2026-07-15', '2026-03-29', '2026-10-25'])(
    'gives a court open from 8 to 23 15 slots on %s',
    (date) => {
      const slots = lisbonSlots(8, 23, date);

      expect(slots).toHaveLength(15);
      expect(slots[0]).toMatch(`${date}T08:00:00`);
      expect(slots.at(-1)).toMatch(`to ${date}T23:00:00`);
    },
  );

  it('splits an ordinary day into consecutive hours from opening to closing', () => {
    expect(lisbonSlots(21, 24, '2026-07-15')).toEqual([
      '2026-07-15T21:00:00+01:00 to 2026-07-15T22:00:00+01:00',
      '2026-07-15T22:00:00+01:00 to 2026-07-15T23:00:00+01:00',
      '2026-07-15T23:00:00+01:00 to 2026-07-16T00:00:00+01:00',
    ]);
  });

  it('skips 01:00 on the day the clocks go forward', () => {
    expect(lisbonSlots(0, 24, '2026-03-29').slice(0, 3)).toEqual([
      '2026-03-29T00:00:00+00:00 to 2026-03-29T02:00:00+01:00',
      '2026-03-29T02:00:00+01:00 to 2026-03-29T03:00:00+01:00',
      '2026-03-29T03:00:00+01:00 to 2026-03-29T04:00:00+01:00',
    ]);
  });

  it('has two slots that both read 01:00, with different offsets, on the day the clocks go back', () => {
    expect(lisbonSlots(0, 24, '2026-10-25').slice(0, 4)).toEqual([
      '2026-10-25T00:00:00+01:00 to 2026-10-25T01:00:00+01:00',
      '2026-10-25T01:00:00+01:00 to 2026-10-25T01:00:00+00:00',
      '2026-10-25T01:00:00+00:00 to 2026-10-25T02:00:00+00:00',
      '2026-10-25T02:00:00+00:00 to 2026-10-25T03:00:00+00:00',
    ]);
  });

  // A court is open while the clock shows a time from its opening hour up to its closing hour.
  it.each([
    { openingHour: 1, closingHour: 3, date: '2026-03-29', starts: ['2026-03-29T02:00:00+01:00'] },
    { openingHour: 1, closingHour: 2, date: '2026-03-29', starts: [] },
    { openingHour: 0, closingHour: 1, date: '2026-03-29', starts: ['2026-03-29T00:00:00+00:00'] },
    {
      openingHour: 1,
      closingHour: 2,
      date: '2026-10-25',
      starts: ['2026-10-25T01:00:00+01:00', '2026-10-25T01:00:00+00:00'],
    },
    { openingHour: 0, closingHour: 1, date: '2026-10-25', starts: ['2026-10-25T00:00:00+01:00'] },
  ])(
    'gives a court open from $openingHour to $closingHour on $date the slots starting $starts',
    ({ openingHour, closingHour, date, starts }) => {
      const slots = daySlots({ openingHour, closingHour }, Temporal.PlainDate.from(date));

      expect(slots.map(({ start }) => lisbon(start))).toEqual(starts);
    },
  );
});

describe('hasStarted', () => {
  const start = Temporal.Instant.from('2026-07-15T18:00:00+01:00');

  it('is true once now reaches the start', () => {
    expect(hasStarted(start, Temporal.Instant.from('2026-07-15T18:00:00+01:00'))).toBe(true);
    expect(hasStarted(start, Temporal.Instant.from('2026-07-15T18:30:00+01:00'))).toBe(true);
  });

  it('is false until then, even 1 ms before', () => {
    expect(hasStarted(start, Temporal.Instant.from('2026-07-15T17:59:59.999+01:00'))).toBe(false);
  });
});
