import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alertText,
  ana,
  logIn,
  problem,
  renderApp,
  requestCount,
  statusText,
  stubApi,
  tableRows,
} from '../test-utils';
import { type Booking } from './bookings';

function booking(
  fields: Pick<Booking, 'id' | 'startsAt' | 'endsAt' | 'cancellableUntil'> & Partial<Booking>,
): Booking {
  return {
    court: { id: 'c1', name: 'Court 1', sport: 'padel' },
    hours: 1,
    priceCents: 1500,
    status: 'confirmed',
    createdAt: '2026-11-01T10:00:00+00:00',
    cancelledAt: null,
    ...fields,
  };
}

// Ana's bookings at 16:00 on 5 November 2026, in winter, when Lisbon is at UTC.
const startsInAnHour = booking({
  id: 'b1',
  startsAt: '2026-11-05T17:00:00+00:00',
  endsAt: '2026-11-05T18:00:00+00:00',
  cancellableUntil: '2026-11-05T15:00:00+00:00',
});
const startsInTwoHours = booking({
  id: 'b2',
  court: { id: 'c2', name: 'Court 2', sport: 'tennis' },
  startsAt: '2026-11-05T18:00:00+00:00',
  endsAt: '2026-11-05T20:00:00+00:00',
  hours: 2,
  priceCents: 4000,
  cancellableUntil: '2026-11-05T16:00:00+00:00',
});
const cancelledLastWeek = booking({
  id: 'b3',
  startsAt: '2026-11-02T10:00:00+00:00',
  endsAt: '2026-11-02T11:00:00+00:00',
  cancellableUntil: '2026-11-02T08:00:00+00:00',
  status: 'cancelled',
  cancelledAt: '2026-11-01T12:00:00+00:00',
});
const anasBookings = Response.json({
  upcoming: [startsInAnHour, startsInTwoHours],
  past: [cancelledLastWeek],
});

const cancelCourt2 = 'Cancel Court 2 on Thu, 5 Nov 2026, 18:00–20:00';

describe('My bookings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T16:00:00Z'));
  });

  it('lists upcoming and past bookings, and offers to cancel up to cancellableUntil', async () => {
    stubApi({ 'GET /api/auth/me': Response.json(ana), 'GET /api/bookings': anasBookings });
    renderApp('/bookings');

    // Court 2 can be cancelled until 16:00, the very moment of the test.
    expect(tableRows(await screen.findByRole('table', { name: 'Upcoming' }))).toEqual([
      ['Court 1', 'Thu, 5 Nov 2026', '17:00–18:00', '€15.00', 'Confirmed', ''],
      ['Court 2', 'Thu, 5 Nov 2026', '18:00–20:00', '€40.00', 'Confirmed', 'Cancel'],
    ]);
    expect(tableRows(screen.getByRole('table', { name: 'Past' }))).toEqual([
      ['Court 1', 'Mon, 2 Nov 2026', '10:00–11:00', '€15.00', 'Cancelled', ''],
    ]);
  });

  it('no longer offers to cancel once cancellableUntil has passed', async () => {
    vi.setSystemTime(new Date('2026-11-05T16:00:00.001Z'));
    stubApi({ 'GET /api/auth/me': Response.json(ana), 'GET /api/bookings': anasBookings });
    renderApp('/bookings');

    expect(await screen.findByRole('table', { name: 'Upcoming' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Cancel/ })).toBeNull();
  });

  it('cancels after confirmation and refreshes the list', async () => {
    const user = userEvent.setup();
    const cancelled = {
      ...startsInTwoHours,
      status: 'cancelled',
      cancelledAt: '2026-11-05T16:00:00+00:00',
    };
    const api = {
      'GET /api/auth/me': Response.json(ana),
      'GET /api/bookings': anasBookings,
      'POST /api/bookings/b2/cancel': Response.json(cancelled),
    };
    const fetchMock = stubApi(api);
    renderApp('/bookings');

    await user.click(await screen.findByRole('button', { name: cancelCourt2 }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this booking?' });
    expect(within(dialog).getByText('Court 2 on Thu, 5 Nov 2026, 18:00–20:00')).toBeTruthy();

    api['GET /api/bookings'] = Response.json({
      upcoming: [startsInAnHour, cancelled],
      past: [cancelledLastWeek],
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    expect(await statusText()).toBe('Cancelled Court 2 on Thu, 5 Nov 2026, 18:00–20:00.');
    expect(requestCount(fetchMock, 'POST /api/bookings/b2/cancel')).toBe(1);
    expect(requestCount(fetchMock, 'GET /api/bookings')).toBe(2);
    expect(tableRows(screen.getByRole('table', { name: 'Upcoming' }))[1]).toEqual([
      'Court 2',
      'Thu, 5 Nov 2026',
      '18:00–20:00',
      '€40.00',
      'Cancelled',
      '',
    ]);
  });

  it("shows the server's reason when the window has closed meanwhile, and refreshes", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({
      'GET /api/auth/me': Response.json(ana),
      'GET /api/bookings': anasBookings,
      'POST /api/bookings/b2/cancel': problem(
        422,
        'CANCELLATION_WINDOW_CLOSED',
        'Bookings can be cancelled until 2 hours before they start.',
      ),
    });
    renderApp('/bookings');

    await user.click(await screen.findByRole('button', { name: cancelCourt2 }));
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));

    expect(await alertText()).toBe('Bookings can be cancelled until 2 hours before they start.');
    expect(requestCount(fetchMock, 'GET /api/bookings')).toBe(2);
  });

  it('are forgotten on logout, so the next person on the browser never sees them', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({
      'GET /api/auth/me': Response.json(ana),
      'GET /api/bookings': anasBookings,
      'POST /api/auth/logout': new Response(null, { status: 204 }),
      'POST /api/auth/login': Response.json({ ...ana, id: 'u3', name: 'Bea Costa' }),
      'GET /api/courts': Response.json([]),
    });
    renderApp('/bookings');
    expect(await screen.findByRole('table', { name: 'Upcoming' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await logIn('bea@example.com', 'correct horse');
    expect(await screen.findByText('There are no courts to book right now.')).toBeTruthy();
    // Bea's own bookings never arrive, so only a cached list could fill the page.
    fetchMock.mockReturnValueOnce(
      new Promise<Response>(() => {
        // Never settles.
      }),
    );
    await user.click(await screen.findByRole('link', { name: 'My bookings' }));

    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
