import {
  type QueryClient,
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { apiRequest } from '../api';
import { availabilityKey, type Sport } from '../courts/courts';
import { formatDate, formatTimeRange } from '../format';

export interface Booking {
  id: string;
  court: { id: string; name: string; sport: Sport };
  startsAt: string;
  endsAt: string;
  hours: 1 | 2;
  /** The court's hourly price when booked, times hours. */
  priceCents: number;
  status: 'confirmed' | 'cancelled';
  /** startsAt minus 2 hours; cancelling is allowed up to and including this moment. */
  cancellableUntil: string;
  createdAt: string;
  cancelledAt: string | null;
}

interface MyBookings {
  /** Not ended yet, soonest first. */
  upcoming: Booking[];
  /** Ended, most recent first. */
  past: Booking[];
}

interface NewBooking {
  courtId: string;
  startsAt: string;
  hours: 1 | 2;
}

const myBookingsKey = ['bookings'];

/** A booking in a few words, such as "Court 1 on Thu, 5 Nov 2026, 18:00–20:00". */
export function describeBooking({ court, startsAt, endsAt }: Booking): string {
  return `${court.name} on ${formatDate(startsAt)}, ${formatTimeRange(startsAt, endsAt)}`;
}

/**
 * Refetches the slots and the user's bookings after a booking or a cancellation. A refused one
 * counts too: it means the server knows something newer, such as a slot just taken.
 */
async function refreshAfterChange(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: availabilityKey }),
    queryClient.invalidateQueries({ queryKey: myBookingsKey }),
  ]);
}

/** The user's own bookings, cancelled ones included. */
export function useMyBookings(): UseQueryResult<MyBookings> {
  return useQuery({
    queryKey: myBookingsKey,
    queryFn: async () => (await apiRequest('/bookings')) as MyBookings,
  });
}

export function useBookCourt(): UseMutationResult<Booking, Error, NewBooking> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (booking: NewBooking) =>
      (await apiRequest('/bookings', { method: 'POST', body: booking })) as Booking,
    // Returned, so the mutation stays pending until the fresh slots have arrived.
    onSettled: () => refreshAfterChange(queryClient),
  });
}

export function useCancelBooking(): UseMutationResult<Booking, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) =>
      (await apiRequest(`/bookings/${bookingId}/cancel`, { method: 'POST' })) as Booking,
    onSettled: () => refreshAfterChange(queryClient),
  });
}
