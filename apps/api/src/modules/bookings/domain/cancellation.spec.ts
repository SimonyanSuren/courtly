import { describe, expect, it } from '@jest/globals';

import { canCancel } from './cancellation';

function canCancelAt(start: string, now: string): boolean {
  return canCancel(Temporal.Instant.from(start), Temporal.Instant.from(now));
}

describe('canCancel', () => {
  const start = '2026-07-15T18:00:00+01:00';

  it('allows cancelling more than 2 hours before the start', () => {
    expect(canCancelAt(start, '2026-07-15T09:00:00+01:00')).toBe(true);
  });

  it('allows cancelling exactly 2 hours before the start', () => {
    expect(canCancelAt(start, '2026-07-15T16:00:00.000+01:00')).toBe(true);
  });

  it('rejects cancelling 1 ms later', () => {
    expect(canCancelAt(start, '2026-07-15T16:00:00.001+01:00')).toBe(false);
  });

  it('rejects cancelling once the booking has started', () => {
    expect(canCancelAt(start, '2026-07-15T18:30:00+01:00')).toBe(false);
  });

  // The facility's clock moves 3 hours, then 1 hour, in these 2 real hours.
  it.each([
    { start: '2026-03-29T03:00:00+01:00', lastChance: '2026-03-29T00:00:00+00:00' },
    { start: '2026-10-25T02:00:00+00:00', lastChance: '2026-10-25T01:00:00+01:00' },
  ])('counts 2 real hours when the clocks change: $start until $lastChance', (booking) => {
    const oneMsLater = Temporal.Instant.from(booking.lastChance).add({ milliseconds: 1 });

    expect(canCancelAt(booking.start, booking.lastChance)).toBe(true);
    expect(canCancelAt(booking.start, oneMsLater.toString())).toBe(false);
  });
});
