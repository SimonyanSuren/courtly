import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { App } from './app';

const ana = { id: 'u1', email: 'ana@example.com', name: 'Ana Silva', role: 'user' };
const admin = { id: 'u2', email: 'admin@example.com', name: 'Rui Admin', role: 'admin' };

function problem(status: number, code: string, detail: string, errors?: unknown[]): Response {
  return Response.json(
    { type: 'about:blank', status, detail, code, errors },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const loggedOut = problem(401, 'UNAUTHORIZED', 'Log in to continue.');

type FetchMock = Mock<(path: string, init?: RequestInit) => Promise<Response>>;

/**
 * Replaces fetch with a table of "METHOD path" to its response. A TypeError stands for a request
 * that got no response, which is how fetch reports a network failure.
 */
function stubApi(responses: Record<string, Response | TypeError>): FetchMock {
  const fetchMock: FetchMock = vi.fn((path: string, init?: RequestInit) => {
    const request = `${init?.method ?? 'GET'} ${path}`;
    const response = responses[request];

    if (response === undefined) {
      return Promise.reject(new Error(`Unexpected request: ${request}`));
    }

    return response instanceof Response
      ? Promise.resolve(response.clone())
      : Promise.reject(response);
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function renderApp(path: string): void {
  // No retries, so a failed request shows its error at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    // The test environment turns off transitions, so content appears without waiting.
    <MantineProvider env="test">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

async function logIn(email: string, password: string): Promise<void> {
  const user = userEvent.setup();
  // Anchored: the labels end with the required-field asterisk, and the password visibility
  // toggle mentions "password" too.
  await user.type(await screen.findByLabelText(/^Email/), email);
  await user.type(screen.getByLabelText(/^Password/), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

async function alertText(): Promise<string | null> {
  const alert = await screen.findByRole('alert');

  return alert.textContent;
}

describe('logging in', () => {
  it('sends the credentials and takes a user to the Courts page', async () => {
    const fetchMock = stubApi({
      'GET /api/auth/me': loggedOut,
      'POST /api/auth/login': Response.json(ana),
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
    stubApi({ 'GET /api/auth/me': Response.json(ana) });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Courts' })).toBeTruthy();
  });

  it('sends visitors without a session to the login page', async () => {
    stubApi({ 'GET /api/auth/me': loggedOut });
    renderApp('/courts');

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it('keeps a user out of admin pages', async () => {
    stubApi({ 'GET /api/auth/me': Response.json(ana) });
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

  it('ends on logout and returns to the login page', async () => {
    const fetchMock = stubApi({
      'GET /api/auth/me': Response.json(ana),
      'POST /api/auth/logout': new Response(null, { status: 204 }),
    });
    renderApp('/courts');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });
});
