import { z } from 'zod';

import { type MyBookings } from '../bookings.service';
import { bookingSchema, toBookingResponse } from './booking.response';

export const myBookingsSchema = z.object({
  upcoming: z.array(bookingSchema).meta({ description: 'Not ended yet, soonest first.' }),
  past: z.array(bookingSchema).meta({ description: 'Ended, most recent first.' }),
});

export type MyBookingsResponse = z.output<typeof myBookingsSchema>;

export function toMyBookingsResponse({ upcoming, past }: MyBookings): MyBookingsResponse {
  return { upcoming: upcoming.map(toBookingResponse), past: past.map(toBookingResponse) };
}
