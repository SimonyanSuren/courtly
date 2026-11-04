import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatHour,
  formatPrice,
  formatSport,
  formatTime,
  formatTimeRange,
} from './format';

describe('formatting', () => {
  it("shows moments on the facility's clock, whatever the device's zone", () => {
    // The tests run in New York. Lisbon is at UTC+1 in summer and at UTC in winter.
    expect(formatTime('2026-07-05T17:00:00Z')).toBe('18:00');
    expect(formatTime('2026-11-05T18:00:00+00:00')).toBe('18:00');
    expect(formatDate('2026-07-05T23:30:00Z')).toBe('Mon, 6 Jul 2026');
    expect(formatTimeRange('2026-07-05T23:00:00+01:00', '2026-07-06T00:00:00+01:00')).toBe(
      '23:00–00:00',
    );
  });

  it('shows integer euro cents as euros', () => {
    expect(formatPrice(1500)).toBe('€15.00');
    expect(formatPrice(123_456)).toBe('€1,234.56');
  });

  it('shows opening hours, up to the midnight that ends the day', () => {
    expect(formatHour(8)).toBe('08:00');
    expect(formatHour(24)).toBe('24:00');
  });

  it('shows a sport as a name', () => {
    expect(formatSport('padel')).toBe('Padel');
    expect(formatSport('pickleball')).toBe('Pickleball');
  });
});
