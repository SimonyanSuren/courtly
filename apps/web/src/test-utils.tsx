import { MantineProvider } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { type Mock, vi } from 'vitest';

import { App } from './app';
import { createQueryClient } from './query-client';
import { theme } from './theme';

export const ana = { id: 'u1', email: 'ana@example.com', name: 'Ana Silva', role: 'user' };

export const admin = { id: 'u2', email: 'admin@example.com', name: 'Rui Admin', role: 'admin' };

export function problem(
  status: number,
  code: string,
  detail: string,
  errors?: unknown[],
): Response {
  return Response.json(
    { type: 'about:blank', status, detail, code, errors },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type FetchMock = Mock<(path: string, init?: RequestInit) => Promise<Response>>;

/**
 * Replaces fetch with a table of "METHOD path" to its response. A TypeError stands for a request
 * that got no response, which is how fetch reports a network failure. The table is read on every
 * request, so a test can change an answer halfway, as the server's state would.
 */
export function stubApi(responses: Record<string, Response | TypeError>): FetchMock {
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

/** How many times the app sent a request, such as "GET /api/bookings". */
export function requestCount(fetchMock: FetchMock, request: string): number {
  return fetchMock.mock.calls.filter(
    ([path, init]) => `${init?.method ?? 'GET'} ${path}` === request,
  ).length;
}

/** The app at a path, with the query client it runs with in the browser. */
export function renderApp(path: string): void {
  render(
    // The test environment turns off transitions, so content appears without waiting.
    <MantineProvider theme={theme} env="test">
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

export async function logIn(email: string, password: string): Promise<void> {
  const user = userEvent.setup();
  // Anchored: the labels end with the required-field asterisk, and the password visibility
  // toggle mentions "password" too.
  await user.type(await screen.findByLabelText(/^Email/), email);
  await user.type(screen.getByLabelText(/^Password/), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

/** The text of the error notice. */
export async function alertText(): Promise<string | null> {
  const alert = await screen.findByRole('alert');

  return alert.textContent;
}

/** The text of the success notice. */
export async function statusText(): Promise<string | null> {
  const status = await screen.findByRole('status');

  return status.textContent;
}

/** The text of each cell in a table's body, row by row. */
export function tableRows(table: HTMLElement): string[][] {
  return [...table.querySelectorAll(':scope > tbody > tr')].map((row) =>
    [...row.querySelectorAll(':scope > td')].map((cell) => cell.textContent),
  );
}
