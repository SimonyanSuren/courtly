import {
  hashKey,
  type QueryClient,
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { ApiError, apiRequest } from '../api';

export type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface Credentials {
  email: string;
  password: string;
}

const currentUserKey = ['auth', 'me'];

/**
 * Logs the user out of the app: nobody is logged in any more, and every answer fetched for them is
 * forgotten, so the next person on this browser sees none of it. The current-user query stays,
 * set to null, because the pages that read it are told only about changes to it, not its removal.
 */
function endSession(queryClient: QueryClient): void {
  queryClient.setQueryData(currentUserKey, null);
  queryClient.removeQueries({ predicate: (query) => query.queryHash !== hashKey(currentUserKey) });
}

/**
 * A 401 to any request once logged in means the session expired or ended elsewhere, so the app
 * logs out too and the login page shows. At login itself, a 401 only means wrong credentials.
 */
export function endSessionIfUnauthorized(queryClient: QueryClient, error: Error): void {
  if (
    error instanceof ApiError &&
    error.status === 401 &&
    queryClient.getQueryData(currentUserKey)
  ) {
    endSession(queryClient);
  }
}

/** Where each role lands after logging in. */
export function homePath(role: Role): string {
  return role === 'admin' ? '/admin' : '/courts';
}

/**
 * The logged-in user, or null when nobody is. The session lives in an httpOnly cookie that
 * JavaScript cannot read, so only the API can say who is logged in, including after a reload.
 */
export function useCurrentUser(): UseQueryResult<User | null> {
  return useQuery({
    queryKey: currentUserKey,
    // Asked once per page load. Afterwards only login and logout change the answer, and they set
    // it themselves; refetching whenever a page mounts would just repeat the question.
    staleTime: Infinity,
    queryFn: async () => {
      try {
        return (await apiRequest('/auth/me')) as User;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }

        throw error;
      }
    },
  });
}

export function useLogin(): UseMutationResult<User, Error, Credentials> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      (await apiRequest('/auth/login', { method: 'POST', body: credentials })) as User,
    // The login response is the user, so the app needs no extra request to learn the role.
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserKey, user);
    },
  });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiRequest('/auth/logout', { method: 'POST' });
    },
    onSuccess: () => {
      endSession(queryClient);
    },
  });
}
