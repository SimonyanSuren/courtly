import { FACILITY_TIME_ZONE, type OpeningHours } from '../../courts/domain/opening-hours';
import { daySlots, hasStarted, type TimeRange } from './slots';

/** The first broken rule, checked in this order; each value can serve as an API error code. */
type BookingRejection =
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
 * Checks a booking of 1 or 2 hours from `start` against the court's opening hours and the time
 * now. If it can be made, returns the time range it holds.
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

  // A booking is consecutive slots of its start's date, the same slots availability lists, so
  // both always agree on what can be booked.
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
