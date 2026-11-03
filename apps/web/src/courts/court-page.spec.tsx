import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  alertText,
  ana,
  problem,
  renderApp,
  requestCount,
  statusText,
  stubApi,
  tableRows,
} from '../test-utils';
import { type Slot } from './courts';

const court = {
  id: 'c1',
  name: 'Court 1',
  sport: 'padel',
  hourlyPriceCents: 1500,
  openingHour: 18,
  closingHour: 22,
  active: true,
};
// A summer day: Lisbon is at UTC+1, and the tests' zone, New York, 5 hours behind it.
const date = '2026-07-05';
const availability = `GET /api/courts/c1/availability?date=${date}`;

/** The court's day, 18:00 to 22:00, with one status for each of its 4 slots. */
function day(...statuses: Array<Slot['status']>): Response {
  return Response.json({
    court,
    date,
    slots: statuses.map((status, index) => ({
      startsAt: `${date}T${String(18 + index)}:00:00+01:00`,
      endsAt: `${date}T${String(19 + index)}:00:00+01:00`,
      status,
    })),
  });
}

function slotTable(): HTMLElement {
  return screen.getByRole('table');
}

describe("a court's page", () => {
  it("shows the court and the day's slots on the facility's clock, each with its status", async () => {
    stubApi({
      'GET /api/auth/me': Response.json(ana),
      [availability]: day('started', 'taken', 'available', 'available'),
    });
    renderApp(`/courts/c1?date=${date}`);

    expect(await screen.findByRole('heading', { name: 'Court 1' })).toBeTruthy();
    expect(screen.getByText('€15.00 per hour · Open 18:00–22:00')).toBeTruthy();
    expect(tableRows(slotTable())).toEqual([
      ['18:00–19:00', 'Started', ''],
      ['19:00–20:00', 'Taken', ''],
      ['20:00–21:00', 'Available', 'Book'],
      ['21:00–22:00', 'Available', 'Book'],
    ]);
  });

  it("shows today's slots at the facility when no date is chosen", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Already the 6th in Lisbon, still the 5th in UTC and in New York.
    vi.setSystemTime(new Date('2026-07-05T23:30:00Z'));
    stubApi({
      'GET /api/auth/me': Response.json(ana),
      'GET /api/courts/c1/availability?date=2026-07-06': day('available', 'available'),
    });
    renderApp('/courts/c1');

    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.getByLabelText('Date')).toHaveProperty('value', '2026-07-06');
  });

  it('books 2 consecutive hours after confirmation and refreshes the slots', async () => {
    const user = userEvent.setup();
    const api = {
      'GET /api/auth/me': Response.json(ana),
      [availability]: day('available', 'available', 'available', 'available'),
      'POST /api/bookings': Response.json(
        {
          id: 'b1',
          court: { id: 'c1', name: 'Court 1', sport: 'padel' },
          startsAt: `${date}T18:00:00+01:00`,
          endsAt: `${date}T20:00:00+01:00`,
          hours: 2,
          priceCents: 3000,
          status: 'confirmed',
          cancellableUntil: `${date}T16:00:00+01:00`,
          createdAt: `${date}T10:00:00+01:00`,
          cancelledAt: null,
        },
        { status: 201 },
      ),
    };
    const fetchMock = stubApi(api);
    renderApp(`/courts/c1?date=${date}`);

    await user.click(await screen.findByRole('button', { name: 'Book 18:00–19:00' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm your booking' });
    await user.click(within(dialog).getByRole('radio', { name: '2 hours' }));

    expect(within(dialog).getByText('Court 1 on Sun, 5 Jul 2026, 18:00–20:00')).toBeTruthy();
    expect(within(dialog).getByText('Price: €30.00')).toBeTruthy();

    api[availability] = day('taken', 'taken', 'available', 'available');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm booking' }));

    expect(await statusText()).toBe(
      'Booked Court 1 on Sun, 5 Jul 2026, 18:00–20:00, for €30.00. See my bookings',
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courtId: 'c1', startsAt: `${date}T18:00:00+01:00`, hours: 2 }),
    });
    expect(requestCount(fetchMock, availability)).toBe(2);
    expect(tableRows(slotTable())[0]).toEqual(['18:00–19:00', 'Taken', '']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers 2 hours only when the next slot is free too', async () => {
    const user = userEvent.setup();
    stubApi({
      'GET /api/auth/me': Response.json(ana),
      [availability]: day('available', 'available', 'taken', 'available'),
    });
    renderApp(`/courts/c1?date=${date}`);

    async function durationsOffered(slot: string): Promise<string[]> {
      await user.click(await screen.findByRole('button', { name: `Book ${slot}` }));
      const dialog = screen.getByRole('dialog');
      const durations = within(dialog)
        .queryAllByRole('radio')
        .map((radio) => radio.getAttribute('value') ?? '');
      await user.click(within(dialog).getByRole('button', { name: 'Back' }));

      return durations;
    }

    expect(await durationsOffered('18:00–19:00')).toEqual(['1', '2']);
    // The next slot is taken.
    expect(await durationsOffered('19:00–20:00')).toEqual([]);
    // The court closes after this slot.
    expect(await durationsOffered('21:00–22:00')).toEqual([]);
  });

  it('shows why a booking failed and refreshes the slots', async () => {
    const user = userEvent.setup();
    const api = {
      'GET /api/auth/me': Response.json(ana),
      [availability]: day('available', 'available', 'available', 'available'),
      'POST /api/bookings': problem(
        409,
        'SLOT_TAKEN',
        'Someone else booked this court for that time.',
      ),
    };
    const fetchMock = stubApi(api);
    renderApp(`/courts/c1?date=${date}`);

    await user.click(await screen.findByRole('button', { name: 'Book 19:00–20:00' }));
    // Meanwhile, someone else books that hour.
    api[availability] = day('available', 'taken', 'available', 'available');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await alertText()).toBe('Someone else booked this court for that time.');
    expect(requestCount(fetchMock, availability)).toBe(2);
    expect(tableRows(slotTable())[1]).toEqual(['19:00–20:00', 'Taken', '']);
  });
});
