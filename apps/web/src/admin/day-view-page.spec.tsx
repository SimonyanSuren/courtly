import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  admin,
  alertText,
  problem,
  renderApp,
  requestCount,
  stubApi,
  tableRows,
} from '../test-utils';
import { type AdminBooking } from './day-view';

// A summer day: Lisbon is at UTC+1, and the tests' zone, New York, 5 hours behind it.
const date = '2026-07-05';
const dayView = `GET /api/admin/bookings?date=${date}`;

function booking(
  fields: Pick<AdminBooking, 'id' | 'court' | 'user' | 'startsAt' | 'endsAt'> &
    Partial<AdminBooking>,
): AdminBooking {
  return {
    hours: 1,
    priceCents: 1500,
    status: 'confirmed',
    cancellableUntil: fields.startsAt,
    createdAt: '2026-07-01T10:00:00+01:00',
    cancelledAt: null,
    ...fields,
  };
}

const court1 = { id: 'c1', name: 'Court 1', sport: 'padel' } as const;
const court2 = { id: 'c2', name: 'Court 2', sport: 'tennis' } as const;
const ana = { id: 'u1', name: 'Ana Silva', email: 'ana@example.com' };
const bea = { id: 'u3', name: 'Bea Costa', email: 'bea@example.com' };

const bookings = [
  booking({
    id: 'b1',
    court: court1,
    user: ana,
    startsAt: `${date}T09:00:00+01:00`,
    endsAt: `${date}T11:00:00+01:00`,
    hours: 2,
    priceCents: 3000,
  }),
  booking({
    id: 'b2',
    court: court1,
    user: bea,
    startsAt: `${date}T18:00:00+01:00`,
    endsAt: `${date}T19:00:00+01:00`,
    status: 'cancelled',
    cancelledAt: '2026-07-04T12:00:00+01:00',
  }),
  booking({
    id: 'b3',
    court: court2,
    user: bea,
    // Written in UTC: still 23:00 on the 5th in Lisbon.
    startsAt: '2026-07-05T22:00:00Z',
    endsAt: '2026-07-05T23:00:00Z',
    priceCents: 2050,
  }),
];

describe('the day view', () => {
  it("lists the day's bookings on the facility's clock, with the server's expected revenue", async () => {
    stubApi({
      'GET /api/auth/me': Response.json(admin),
      [dayView]: Response.json({ date, bookings, expectedRevenueCents: 5050 }),
    });
    renderApp(`/admin/bookings?date=${date}`);

    expect(tableRows(await screen.findByRole('table'))).toEqual([
      ['Court 1', '09:00–11:00', 'Ana Silva', 'ana@example.com', '€30.00', 'Confirmed'],
      ['Court 1', '18:00–19:00', 'Bea Costa', 'bea@example.com', '€15.00', 'Cancelled'],
      ['Court 2', '23:00–00:00', 'Bea Costa', 'bea@example.com', '€20.50', 'Confirmed'],
    ]);
    // The cancelled booking is listed but not counted.
    expect(screen.getByText('Expected revenue: €50.50')).toBeTruthy();
    expect(screen.getByLabelText('Date')).toHaveProperty('value', date);
  });

  it('opens on today at the facility', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Already the 6th in Lisbon, still the 5th in UTC and in New York.
    vi.setSystemTime(new Date('2026-07-05T23:30:00Z'));
    stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/admin/bookings?date=2026-07-06': Response.json({
        date: '2026-07-06',
        bookings: [],
        expectedRevenueCents: 0,
      }),
    });
    renderApp('/admin/bookings');

    expect(await screen.findByText('No bookings on this day.')).toBeTruthy();
    expect(screen.getByText('Expected revenue: €0.00')).toBeTruthy();
    expect(screen.getByLabelText('Date')).toHaveProperty('value', '2026-07-06');
  });

  it('asks for the chosen date', async () => {
    const fetchMock = stubApi({
      'GET /api/auth/me': Response.json(admin),
      [dayView]: Response.json({ date, bookings, expectedRevenueCents: 5050 }),
      'GET /api/admin/bookings?date=2026-07-06': Response.json({
        date: '2026-07-06',
        bookings: [bookings[0]],
        expectedRevenueCents: 3000,
      }),
    });
    renderApp(`/admin/bookings?date=${date}`);
    expect(await screen.findByText('Expected revenue: €50.50')).toBeTruthy();

    // A date picker reports the whole date at once, which typing into jsdom's input does not.
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-06' } });

    expect(await screen.findByText('Expected revenue: €30.00')).toBeTruthy();
    expect(requestCount(fetchMock, 'GET /api/admin/bookings?date=2026-07-06')).toBe(1);
  });

  it("shows the server's explanation when the date is refused", async () => {
    stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/admin/bookings?date=someday': problem(
        400,
        'VALIDATION_FAILED',
        'The request has invalid values.',
        [{ in: 'query', path: 'date', message: 'Must be a date such as 2026-11-05.' }],
      ),
    });
    renderApp('/admin/bookings?date=someday');

    expect(await alertText()).toBe('The request has invalid values.');
  });
});
