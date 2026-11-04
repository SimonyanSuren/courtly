import { z } from 'zod';

import { userSchema } from '../../users/dto/user.response';
import { type DayView } from '../bookings.service';
import { bookingSchema, toBookingResponse } from './booking.response';

const adminBookingSchema = bookingSchema
  .extend({ user: userSchema.pick({ id: true, name: true, email: true }) })
  .meta({ id: 'AdminBooking' });

export const dayViewSchema = z.object({
  date: z.iso.date(),
  bookings: z.array(adminBookingSchema),
  expectedRevenueCents: z
    .number()
    .int()
    .min(0)
    .meta({ description: 'The confirmed bookings only, each at its booked price.' }),
});

export type DayViewResponse = z.output<typeof dayViewSchema>;

export function toDayViewResponse({
  date,
  bookings,
  expectedRevenueCents,
}: DayView): DayViewResponse {
  return {
    date: date.toString(),
    bookings: bookings.map((booking) => ({ ...toBookingResponse(booking), user: booking.user })),
    expectedRevenueCents,
  };
}
