import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ana, renderApp, stubApi } from '../test-utils';

describe('the Courts page', () => {
  it('lists the courts with their sport, hourly price and opening hours', async () => {
    stubApi({
      'GET /api/auth/me': Response.json(ana),
      'GET /api/courts': Response.json([
        {
          id: 'c1',
          name: 'Court 1',
          sport: 'padel',
          hourlyPriceCents: 1500,
          openingHour: 8,
          closingHour: 22,
          active: true,
        },
        {
          id: 'c2',
          name: 'Court 2',
          sport: 'tennis',
          hourlyPriceCents: 2050,
          openingHour: 0,
          closingHour: 24,
          active: true,
        },
      ]),
    });
    renderApp('/courts');

    expect(await screen.findByRole('heading', { name: 'Court 1' })).toBeTruthy();
    expect(screen.getByText('padel')).toBeTruthy();
    expect(screen.getByText('€15.00 per hour')).toBeTruthy();
    expect(screen.getByText('Open 08:00–22:00')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Court 2' })).toBeTruthy();
    expect(screen.getByText('tennis')).toBeTruthy();
    expect(screen.getByText('€20.50 per hour')).toBeTruthy();
    expect(screen.getByText('Open 00:00–24:00')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'See availability at Court 2' }).getAttribute('href'),
    ).toBe('/courts/c2');
  });
});
