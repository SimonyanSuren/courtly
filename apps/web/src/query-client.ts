import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';
import { endSessionIfUnauthorized } from './auth/session';

/**
 * Asks again only when that may help: no response arrived, or the server failed. A 4xx answer
 * would be the same, and retrying a 401 would keep the login page waiting for seconds.
 */
function shouldRetry(failureCount: number, error: Error): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;

  // 3 retries, TanStack Query's default.
  return !isClientError && failureCount < 3;
}

/** The cache of everything the API said, which every request's failure passes through. */
export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error): void => {
        endSessionIfUnauthorized(queryClient, error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error): void => {
        endSessionIfUnauthorized(queryClient, error);
      },
    }),
    defaultOptions: { queries: { retry: shouldRetry } },
  });

  return queryClient;
}
