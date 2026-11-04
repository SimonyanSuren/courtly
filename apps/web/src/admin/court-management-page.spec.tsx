import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type Court } from '../courts/courts';
import {
  admin,
  alertText,
  problem,
  renderApp,
  requestCount,
  stubApi,
  tableRows,
} from '../test-utils';

const court1: Court = {
  id: 'c1',
  name: 'Court 1',
  sport: 'padel',
  hourlyPriceCents: 1500,
  openingHour: 8,
  closingHour: 22,
  active: true,
};
const court2: Court = {
  id: 'c2',
  name: 'Court 2',
  sport: 'tennis',
  hourlyPriceCents: 2050,
  openingHour: 0,
  closingHour: 24,
  active: false,
};
const json = { 'Content-Type': 'application/json' };

function courtTable(): HTMLElement {
  return screen.getByRole('table');
}

/** Checks that the message shows and that the field's description points to it. */
function expectErrorAt(label: RegExp | string, message: string): void {
  const fieldError = screen.getByText(message);
  expect(screen.getByLabelText(label).getAttribute('aria-describedby')).toContain(fieldError.id);
}

async function openForm(buttonName: string, dialogName: string): Promise<HTMLElement> {
  await userEvent.setup().click(await screen.findByRole('button', { name: buttonName }));

  return screen.getByRole('dialog', { name: dialogName });
}

describe('court management', () => {
  it('lists every court, the inactive ones marked as such', async () => {
    stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1, court2]),
    });
    renderApp('/admin/courts');

    expect(tableRows(await screen.findByRole('table'))).toEqual([
      ['Court 1', 'padel', '€15.00', '08:00–22:00', 'Active', 'EditDeactivate'],
      ['Court 2', 'tennis', '€20.50', '00:00–24:00', 'Inactive', 'EditReactivate'],
    ]);
  });

  it('adds a court with its price in cents and refreshes the list', async () => {
    const user = userEvent.setup();
    const court3: Court = {
      id: 'c3',
      name: 'Court 3',
      sport: 'squash',
      hourlyPriceCents: 1510,
      openingHour: 7,
      closingHour: 23,
      active: true,
    };
    const api = {
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1]),
      'POST /api/courts': Response.json(court3, { status: 201 }),
    };
    const fetchMock = stubApi(api);
    renderApp('/admin/courts');

    const dialog = await openForm('Add court', 'Add a court');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Court 3');
    await user.selectOptions(within(dialog).getByLabelText('Sport'), 'squash');
    await user.type(within(dialog).getByLabelText(/^Price per hour/), '15.10');
    await user.selectOptions(within(dialog).getByLabelText('Opening hour'), '07:00');
    await user.selectOptions(within(dialog).getByLabelText('Closing hour'), '23:00');
    api['GET /api/courts'] = Response.json([court1, court3]);
    await user.click(within(dialog).getByRole('button', { name: 'Add court' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/courts', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({
        name: 'Court 3',
        sport: 'squash',
        hourlyPriceCents: 1510,
        openingHour: 7,
        closingHour: 23,
      }),
    });
    expect(requestCount(fetchMock, 'GET /api/courts')).toBe(2);
    expect(tableRows(courtTable())[1]).toEqual([
      'Court 3',
      'squash',
      '€15.10',
      '07:00–23:00',
      'Active',
      'EditDeactivate',
    ]);
  });

  it('refuses a price it cannot read as cents, without asking the server', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1]),
    });
    renderApp('/admin/courts');

    const dialog = await openForm('Add court', 'Add a court');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Court 3');
    await user.type(within(dialog).getByLabelText(/^Price per hour/), '15.105');
    await user.click(within(dialog).getByRole('button', { name: 'Add court' }));

    expectErrorAt(
      /^Price per hour/,
      'Enter the price in euros with up to 2 decimals, such as 15.10.',
    );
    expect(requestCount(fetchMock, 'POST /api/courts')).toBe(0);
  });

  it("shows each of the server's messages next to its field, and the rest above", async () => {
    const user = userEvent.setup();
    stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1]),
      'POST /api/courts': problem(400, 'VALIDATION_FAILED', 'The request has invalid values.', [
        { in: 'body', path: 'name', message: 'Use at most 100 characters.' },
        { in: 'body', path: 'sport', message: 'Must be one of the sports offered.' },
        { in: 'body', path: 'hourlyPriceCents', message: 'Must be more than €0.00.' },
        { in: 'body', path: 'openingHour', message: 'Must be a whole hour from 0 to 24.' },
        { in: 'body', path: 'closingHour', message: 'Must be after the opening hour.' },
        // A rule about the court as a whole has no field of its own.
        { in: 'body', path: '', message: 'Check the opening hours.' },
      ]),
    });
    renderApp('/admin/courts');

    const dialog = await openForm('Add court', 'Add a court');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Court 3');
    await user.type(within(dialog).getByLabelText(/^Price per hour/), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Add court' }));

    expect(await alertText()).toBe('The request has invalid values. Check the opening hours.');
    expectErrorAt(/^Name/, 'Use at most 100 characters.');
    expectErrorAt('Sport', 'Must be one of the sports offered.');
    expectErrorAt(/^Price per hour/, 'Must be more than €0.00.');
    expectErrorAt('Opening hour', 'Must be a whole hour from 0 to 24.');
    expectErrorAt('Closing hour', 'Must be after the opening hour.');
  });

  it('edits a court, starting from its current values, and refreshes the list', async () => {
    const user = userEvent.setup();
    const api = {
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1, court2]),
      'PATCH /api/courts/c1': Response.json({ ...court1, hourlyPriceCents: 1850, closingHour: 23 }),
    };
    const fetchMock = stubApi(api);
    renderApp('/admin/courts');

    const dialog = await openForm('Edit Court 1', 'Edit Court 1');
    const price = within(dialog).getByLabelText(/^Price per hour/);
    expect(within(dialog).getByLabelText(/^Name/)).toHaveProperty('value', 'Court 1');
    expect(within(dialog).getByLabelText('Sport')).toHaveProperty('value', 'padel');
    expect(price).toHaveProperty('value', '15.00');
    expect(within(dialog).getByLabelText('Opening hour')).toHaveProperty('value', '8');
    expect(within(dialog).getByLabelText('Closing hour')).toHaveProperty('value', '22');

    await user.clear(price);
    await user.type(price, '18,50');
    await user.selectOptions(within(dialog).getByLabelText('Closing hour'), '23:00');
    api['GET /api/courts'] = Response.json([
      { ...court1, hourlyPriceCents: 1850, closingHour: 23 },
      court2,
    ]);
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/courts/c1', {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({
        name: 'Court 1',
        sport: 'padel',
        hourlyPriceCents: 1850,
        openingHour: 8,
        closingHour: 23,
      }),
    });
    expect(requestCount(fetchMock, 'GET /api/courts')).toBe(2);
    expect(tableRows(courtTable())[0]).toEqual([
      'Court 1',
      'padel',
      '€18.50',
      '08:00–23:00',
      'Active',
      'EditDeactivate',
    ]);
  });

  it('shows a name already taken next to the name, and refreshes the list', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1, court2]),
      'PATCH /api/courts/c1': problem(
        409,
        'COURT_NAME_TAKEN',
        'Another court already has this name.',
      ),
    });
    renderApp('/admin/courts');

    const dialog = await openForm('Edit Court 1', 'Edit Court 1');
    const name = within(dialog).getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'Court 2');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Another court already has this name.')).toBeTruthy();
    expectErrorAt(/^Name/, 'Another court already has this name.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(requestCount(fetchMock, 'GET /api/courts')).toBe(2);
  });

  it('shows any other refusal above the form', async () => {
    const user = userEvent.setup();
    stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1]),
      'PATCH /api/courts/c1': problem(404, 'COURT_NOT_FOUND', 'There is no such court.'),
    });
    renderApp('/admin/courts');

    const dialog = await openForm('Edit Court 1', 'Edit Court 1');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await alertText()).toBe('There is no such court.');
    expect(within(dialog).getByRole('alert')).toBeTruthy();
  });

  it('deactivates and reactivates courts, refreshing the list each time', async () => {
    const user = userEvent.setup();
    const api = {
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1, court2]),
      'PATCH /api/courts/c1': Response.json({ ...court1, active: false }),
      'PATCH /api/courts/c2': Response.json({ ...court2, active: true }),
    };
    const fetchMock = stubApi(api);
    renderApp('/admin/courts');

    const deactivate = await screen.findByRole('button', { name: 'Deactivate Court 1' });
    api['GET /api/courts'] = Response.json([{ ...court1, active: false }, court2]);
    await user.click(deactivate);

    expect(await screen.findByRole('button', { name: 'Reactivate Court 1' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/courts/c1', {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({ active: false }),
    });

    api['GET /api/courts'] = Response.json([
      { ...court1, active: false },
      { ...court2, active: true },
    ]);
    await user.click(screen.getByRole('button', { name: 'Reactivate Court 2' }));

    expect(await screen.findByRole('button', { name: 'Deactivate Court 2' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/courts/c2', {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({ active: true }),
    });
    expect(requestCount(fetchMock, 'GET /api/courts')).toBe(3);
    expect(tableRows(courtTable()).map((row) => row[4])).toEqual(['Inactive', 'Active']);
  });

  it('shows why a deactivation failed', async () => {
    stubApi({
      'GET /api/auth/me': Response.json(admin),
      'GET /api/courts': Response.json([court1]),
      'PATCH /api/courts/c1': problem(404, 'COURT_NOT_FOUND', 'There is no such court.'),
    });
    renderApp('/admin/courts');

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Deactivate Court 1' }));

    expect(await alertText()).toBe('There is no such court.');
  });
});
