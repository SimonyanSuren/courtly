import { z } from 'zod';

import { courtSchema } from '../../courts/dto/court.response';
import { type Booking } from '../bookings.repository';
import { BookingStatus } from '../domain/booking';
import { cancellableUntil } from '../domain/cancellation';
import { facilityTime, moment } from './moment';

export const bookingSchema = z
  .object({
    id: z.uuid(),
    court: courtSchema.pick({ id: true, name: true, sport: true }),
    startsAt: moment,
    endsAt: moment,
    // A number, as the bookings table types it: 1 or 2.
    hours: z.number().int().min(1).max(2),
    priceCents: z
      .number()
      .int()
      .positive()
      .meta({ description: "The court's hourly price when booked, times hours." }),
    status: z.enum(BookingStatus),
    cancellableUntil: moment.meta({ description: 'startsAt minus 2 hours.' }),
    createdAt: moment.meta({ description: 'When the booking was stored.' }),
    cancelledAt: moment.nullable(),
  })
  .meta({ id: 'Booking' });

export type BookingResponse = z.output<typeof bookingSchema>;

/** Field by field, never spread: a value may carry more than its type says, and it stays out. */
export function toBookingResponse(booking: Booking): BookingResponse {
  return {
    id: booking.id,
    court: { id: booking.court.id, name: booking.court.name, sport: booking.court.sport },
    startsAt: facilityTime(booking.startsAt),
    endsAt: facilityTime(booking.endsAt),
    hours: booking.hours,
    priceCents: booking.priceCents,
    status: booking.status,
    cancellableUntil: facilityTime(cancellableUntil(booking.startsAt)),
    createdAt: facilityTime(booking.createdAt),
    cancelledAt: booking.cancelledAt === null ? null : facilityTime(booking.cancelledAt),
  };
}
