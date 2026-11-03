import { describe, expect, it } from '@jest/globals';

import { expectedRevenueCents } from './revenue';

describe('expectedRevenueCents', () => {
  it('sums the confirmed bookings at their booked prices and skips the cancelled ones', () => {
    expect(
      expectedRevenueCents([
        { status: 'confirmed', priceCents: 2400 },
        { status: 'cancelled', priceCents: 9900 },
        { status: 'confirmed', priceCents: 4800 },
      ]),
    ).toBe(7200);
  });

  it('is 0 for no bookings, or only cancelled ones', () => {
    expect(expectedRevenueCents([])).toBe(0);
    expect(expectedRevenueCents([{ status: 'cancelled', priceCents: 2400 }])).toBe(0);
  });
});
