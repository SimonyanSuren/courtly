import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiRequest } from '../api';
import { type Booking } from '../bookings/bookings';

export interface AdminBooking extends Booking {
  user: { id: string; name: string; email: string };
}

interface DayView {
  /** The day, such as "2026-11-05". */
  date: string;
  /** Every booking that starts that day, cancelled ones included, by court name and start. */
  bookings: AdminBooking[];
  /** The sum of the confirmed bookings, each at its booked price. */
  expectedRevenueCents: number;
}

/** Every booking on one day at the facility, across courts. */
export function useDayView(date: string): UseQueryResult<DayView> {
  return useQuery({
    queryKey: ['admin', 'bookings', date],
    // The date comes from the address bar, so it is encoded to stay one query value.
    queryFn: async () =>
      (await apiRequest(`/admin/bookings?date=${encodeURIComponent(date)}`)) as DayView,
  });
}
