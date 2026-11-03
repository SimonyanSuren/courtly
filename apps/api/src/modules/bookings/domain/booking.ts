import { FACILITY_TIME_ZONE, type OpeningHours } from '../../courts/domain/opening-hours';
import { daySlots, hasStarted, type TimeRange } from './slots';

/** A cancelled booking is kept, for the user's list and the day view, but holds no time. */
export const BookingStatus = { CONFIRMED: 'confirmed', CANCELLED: 'cancelled' } as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** The first broken rule, checked in this order; each value can serve as an API error code. */
export type BookingRejection =
  // Not 1 or 2 hours.
  | 'INVALID_DURATION'
  // The start is not a whole hour on the facility's clock.
  | 'NOT_ON_THE_HOUR'
  // It starts before opening, or ends after closing, on its start's date.
  | 'OUTSIDE_OPENING_HOURS'
  // It starts at or before now.
  | 'ALREADY_STARTED';

type BookingCheck =
  | { readonly ok: true; readonly range: TimeRange }
  | { readonly ok: false; readonly reason: BookingRejection };

/**
 * Whether a booking of `hours` from `start` can be made at a court with these opening hours,
 * given the time now: either the first rule it breaks, or the exact time range to store.
 *
 * A booking can be made when it covers `hours` consecutive slots of its start's date, taken
 * from the same list availability shows (daySlots). Booking and availability then cannot
 * disagree about what is bookable, also on the days the clocks change, and the booking ends
 * where its last slot does. The on-the-hour check comes first only to name the problem: without
 * it, 10:30 would be answered as outside opening hours.
 */
export function checkBooking(
  { start, hours }: { readonly start: Temporal.Instant; readonly hours: number },
  openingHours: OpeningHours,
  now: Temporal.Instant,
): BookingCheck {
  if (hours !== 1 && hours !== 2) {
    return { ok: false, reason: 'INVALID_DURATION' };
  }

  const local = start.toZonedDateTimeISO(FACILITY_TIME_ZONE);

  if (!local.round({ smallestUnit: 'hour', roundingMode: 'floor' }).equals(local)) {
    return { ok: false, reason: 'NOT_ON_THE_HOUR' };
  }

  // A court's day is one block with no gaps, so the slot `hours - 1` places after the first is
  // the booking's last. A break in the day would need a check that the slots are adjacent.
  const slots = daySlots(openingHours, local.toPlainDate());
  const first = slots.findIndex((slot) => slot.start.equals(start));
  const last = first === -1 ? undefined : slots[first + hours - 1];

  if (last === undefined) {
    return { ok: false, reason: 'OUTSIDE_OPENING_HOURS' };
  }

  if (hasStarted(start, now)) {
    return { ok: false, reason: 'ALREADY_STARTED' };
  }

  return { ok: true, range: { start, end: last.end } };
}
