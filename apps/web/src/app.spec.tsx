import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { alertText, ana, logIn, problem, renderApp, stubApi } from './test-utils';

const admin = { id: 'u2', email: 'admin@example.com', name: 'Rui Admin', role: 'admin' };

const loggedOut = problem(401, 'UNAUTHORIZED', 'Log in to continue.');

describe('logging in', () => {
  it('sends the credentials and takes a user to the Courts page', async () => {
    const fetchMock = stubApi({
      'GET /api/auth/me': loggedOut,
      'POST /api/auth/login': Response.json(ana),
      'GET /api/courts': Response.json([]),
    });
    renderApp('/login');

    await logIn('ana@example.com', 'correct horse');

    expect(await screen.findByRole('heading', { name: 'Courts' })).toBeTruthy();
    expect(screen.getByText('Ana Silva')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com', password: 'correct horse' }),
    });
  });

  it('takes an admin to the Admin page', async () => {
    stubApi({ 'GET /api/auth/me': loggedOut, 'POST /api/auth/login': Response.json(admin) });
    renderApp('/login');

    await logIn('admin@example.com', 'correct horse');

    expect(await screen.findByRole('heading', { name: 'Admin' })).toBeTruthy();
  });

  it("shows the server's explanation when the credentials are wrong", async () => {
    stubApi({
      'GET /api/auth/me': loggedOut,
      'POST /api/auth/login': problem(
        401,
        'INVALID_CREDENTIALS',
        'The email or password is incorrect.',
      ),
    });
    renderApp('/login');

    await logIn('ana@example.com', 'wrong');

    expect(await alertText()).toBe('The email or password is incorrect.');
  });

  it('shows each field error next to its field', async () => {
    stubApi({
      'GET /api/auth/me': loggedOut,
      'POST /api/auth/login': problem(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { in: 'body', path: 'email', message: 'Must be at most 254 characters.' },
      ]),
    });
    renderApp('/login');

    await logIn('ana@example.com', 'correct horse');

    const fieldError = await screen.findByText('Must be at most 254 characters.');
    expect(screen.getByLabelText(/^Email/).getAttribute('aria-describedby')).toContain(
      fieldError.id,
    );
  });

  it('shows a friendly message instead of a server error', async () => {
    stubApi({
      'GET /api/auth/me': loggedOut,
      'POST /api/auth/login': problem(500, 'INTERNAL_SERVER_ERROR', 'TypeError at line 42'),
    });
    renderApp('/login');

    await logIn('ana@example.com', 'correct horse');

    expect(await alertText()).toBe(
      'Something went wrong on our side. Please try again in a moment.',
    );
  });

  it('shows a friendly message when the API cannot be reached', async () => {
    stubApi({
      'GET /api/auth/me': loggedOut,
      'POST /api/auth/login': new TypeError('Failed to fetch'),
    });
    renderApp('/login');

    await logIn('ana@example.com', 'correct horse');

    expect(await alertText()).toBe('Could not reach Courtly. Check your connection and try again.');
  });
});

describe('the session', () => {
  it('survives a reload: the app asks the API who is logged in', async () => {
    stubApi({ 'GET /api/auth/me': Response.json(ana), 'GET /api/courts': Response.json([]) });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Courts' })).toBeTruthy();
  });

  it('sends visitors without a session to the login page', async () => {
    stubApi({ 'GET /api/auth/me': loggedOut });
    renderApp('/courts');

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it('keeps a user out of admin pages', async () => {
    stubApi({ 'GET /api/auth/me': Response.json(ana), 'GET /api/courts': Response.json([]) });
    renderApp('/admin');

    expect(await screen.findByRole('heading', { name: 'Courts' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Admin' })).toBeNull();
  });

  it('keeps an admin out of user pages', async () => {
    stubApi({ 'GET /api/auth/me': Response.json(admin) });
    renderApp('/courts');

    expect(await screen.findByRole('heading', { name: 'Admin' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Courts' })).toBeNull();
  });

  it('ends when the API stops accepting it, and the login page shows', async () => {
    stubApi({
      'GET /api/auth/me': Response.json(ana),
      // The session expired while the user was away.
      'GET /api/bookings': loggedOut,
    });
    renderApp('/bookings');

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it('ends on logout and returns to the login page', async () => {
    const fetchMock = stubApi({
      'GET /api/auth/me': Response.json(ana),
      'GET /api/courts': Response.json([]),
      'POST /api/auth/logout': new Response(null, { status: 204 }),
    });
    renderApp('/courts');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });
});

describe('the header', () => {
  it("links the user's pages and marks the current one", async () => {
    const user = userEvent.setup();
    stubApi({
      'GET /api/auth/me': Response.json(ana),
      'GET /api/courts': Response.json([]),
      'GET /api/bookings': Response.json({ upcoming: [], past: [] }),
    });
    renderApp('/courts');

    await user.click(await screen.findByRole('link', { name: 'My bookings' }));

    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'My bookings' }).getAttribute('aria-current')).toBe(
      'page',
    );

    await user.click(screen.getByRole('link', { name: 'Courts' }));

    expect(await screen.findByRole('heading', { name: 'Courts' })).toBeTruthy();
  });
});
