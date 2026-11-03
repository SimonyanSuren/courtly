import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiRequest } from '../api';

/** Every sport a court can be for; the type follows from this list. */
export const sports = ['padel', 'tennis', 'squash', 'badminton', 'pickleball'] as const;

export type Sport = (typeof sports)[number];

export interface Court {
  id: string;
  name: string;
  sport: Sport;
  hourlyPriceCents: number;
  /** 0 to 23. */
  openingHour: number;
  /** 1 to 24, after openingHour; 24 is the midnight that ends the day. */
  closingHour: number;
  active: boolean;
}

export interface Slot {
  startsAt: string;
  endsAt: string;
  /** started: it starts at or before now; taken: a confirmed booking covers it. */
  status: 'available' | 'taken' | 'started';
}

interface Availability {
  court: Court;
  /** The day, such as "2026-11-05". */
  date: string;
  /** One for each hour from opening to closing, in order. */
  slots: Slot[];
}

/** The start of every availability query's key, so a booking can refresh them all. */
export const availabilityKey = ['availability'];

/** The key of the courts list, so a change to a court can refresh it. */
export const courtsKey = ['courts'];

/** The courts by name: the active ones for a user, which they can book, and all for an admin. */
export function useCourts(): UseQueryResult<Court[]> {
  return useQuery({
    queryKey: courtsKey,
    queryFn: async () => (await apiRequest('/courts')) as Court[],
  });
}

/** A court's slots on one day. */
export function useAvailability(courtId: string, date: string): UseQueryResult<Availability> {
  return useQuery({
    queryKey: [...availabilityKey, courtId, date],
    // Both values come from the address bar, so they are encoded to stay what they are: one path
    // segment and one query value.
    queryFn: async () =>
      (await apiRequest(
        `/courts/${encodeURIComponent(courtId)}/availability?date=${encodeURIComponent(date)}`,
      )) as Availability,
    // While another day loads, the page keeps the court's details instead of flashing empty.
    placeholderData: keepPreviousData,
  });
}
