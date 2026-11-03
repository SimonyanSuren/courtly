import {
  type QueryClient,
  useMutation,
  type UseMutationResult,
  useQueryClient,
} from '@tanstack/react-query';

import { apiRequest } from '../api';
import { type Court, courtsKey } from '../courts/courts';

/** What the admin sets on a court's form. */
type CourtFields = Omit<Court, 'id' | 'active'>;

interface CourtSave {
  /** The court to change; undefined adds a new one. */
  courtId: string | undefined;
  fields: CourtFields;
}

interface CourtActivation {
  courtId: string;
  active: boolean;
}

/**
 * Refetches the courts list after a change, accepted or refused: a refusal, such as a name just
 * taken, means the server knows something newer.
 */
async function refreshCourts(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: courtsKey });
}

/** Adds a court, or replaces an existing court's fields. */
export function useSaveCourt(): UseMutationResult<Court, Error, CourtSave> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ courtId, fields }: CourtSave) =>
      (await (courtId === undefined
        ? apiRequest('/courts', { method: 'POST', body: fields })
        : apiRequest(`/courts/${courtId}`, { method: 'PATCH', body: fields }))) as Court,
    // Returned, so the mutation stays pending until the fresh list has arrived.
    onSettled: () => refreshCourts(queryClient),
  });
}

/** Deactivates a court, which stops new bookings and keeps existing ones, or reactivates it. */
export function useSetCourtActive(): UseMutationResult<Court, Error, CourtActivation> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ courtId, active }: CourtActivation) =>
      (await apiRequest(`/courts/${courtId}`, { method: 'PATCH', body: { active } })) as Court,
    onSettled: () => refreshCourts(queryClient),
  });
}
