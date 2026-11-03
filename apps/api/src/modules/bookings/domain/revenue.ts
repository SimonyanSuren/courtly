import { BookingStatus } from './booking';

interface PricedBooking {
  readonly status: BookingStatus;
  readonly priceCents: number;
}

/**
 * What a set of bookings should earn: the confirmed ones, each at the price it was booked at.
 * Cancelled ones earn nothing, and a later change to a court's price does not count.
 */
export function expectedRevenueCents(bookings: readonly PricedBooking[]): number {
  return bookings
    .filter(({ status }) => status === BookingStatus.CONFIRMED)
    .reduce((total, { priceCents }) => total + priceCents, 0);
}
