import { type Court } from '../../courts/courts.schema';
import { FACILITY_TIME_ZONE } from '../../courts/domain/opening-hours';
import { type AdminBooking, type Booking } from '../bookings.repository';
import { type Availability, type DayView, type MyBookings } from '../bookings.service';
import { type BookingStatus } from '../domain/booking';
import { cancellableUntil } from '../domain/cancellation';
import { type SlotStatus } from '../domain/slots';

/*
 * What the bookings routes send, as documented in docs/api.md. The service works with Temporal
 * values; only this file knows how they are written in JSON.
 */

export interface BookingResponse {
  id: string;
  court: Booking['court'];
  startsAt: string;
  endsAt: string;
  hours: number;
  priceCents: number;
  status: BookingStatus;
  cancellableUntil: string;
  createdAt: string;
  cancelledAt: string | null;
}

interface AdminBookingResponse extends BookingResponse {
  user: AdminBooking['user'];
}

export interface MyBookingsResponse {
  upcoming: BookingResponse[];
  past: BookingResponse[];
}

interface SlotResponse {
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
}

export interface AvailabilityResponse {
  court: Court;
  date: string;
  slots: SlotResponse[];
}

export interface DayViewResponse {
  date: string;
  bookings: AdminBookingResponse[];
  expectedRevenueCents: number;
}

/** A moment as the API writes it: with the facility's offset, as 2026-11-05T18:00:00+00:00. */
function facilityTime(instant: Temporal.Instant): string {
  return instant.toZonedDateTimeISO(FACILITY_TIME_ZONE).toString({ timeZoneName: 'never' });
}

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

export function toMyBookingsResponse({ upcoming, past }: MyBookings): MyBookingsResponse {
  return { upcoming: upcoming.map(toBookingResponse), past: past.map(toBookingResponse) };
}

export function toAvailabilityResponse({ court, date, slots }: Availability): AvailabilityResponse {
  return {
    court,
    date: date.toString(),
    slots: slots.map(({ start, end, status }) => ({
      startsAt: facilityTime(start),
      endsAt: facilityTime(end),
      status,
    })),
  };
}

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
