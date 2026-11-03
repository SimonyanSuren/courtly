import {
  FACILITY_TIME_ZONE,
  type OpeningHours,
  openingTimes,
} from '../../courts/domain/opening-hours';

/** The time from start, included, to end, excluded. */
export interface TimeRange {
  readonly start: Temporal.Instant;
  readonly end: Temporal.Instant;
}

/** What availability says of a slot. */
export const SlotStatus = { AVAILABLE: 'available', TAKEN: 'taken', STARTED: 'started' } as const;

export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

/**
 * A calendar day on the facility's clock, from its midnight to the next: 24 hours, or 23 or 25
 * on the days the clocks change.
 */
export function calendarDay(date: Temporal.PlainDate): TimeRange {
  return {
    // Given only a time zone, toZonedDateTime() takes the day's first moment.
    start: date.toZonedDateTime(FACILITY_TIME_ZONE).toInstant(),
    end: date.add({ days: 1 }).toZonedDateTime(FACILITY_TIME_ZONE).toInstant(),
  };
}

/**
 * Whether two ranges share any moment. Each excludes its end, so a booking that ends at 11:00
 * leaves 11:00 free for the next one, as the database's no-overlap constraint does.
 */
export function areOverlapping(a: TimeRange, b: TimeRange): boolean {
  return (
    Temporal.Instant.compare(a.start, b.end) < 0 && Temporal.Instant.compare(b.start, a.end) < 0
  );
}

/**
 * A court's 1-hour slots on a date, from opening to closing. They are real hours: a court open
 * from 0 to 24 has 23 slots on the day the clocks go forward and 25 on the day they go back.
 */
export function daySlots(openingHours: OpeningHours, date: Temporal.PlainDate): TimeRange[] {
  const { opens, closes } = openingTimes(openingHours, date);
  // Whole hours only, so no slot can run past closing.
  const { hours } = opens.until(closes, { largestUnit: 'hours' });

  return Array.from({ length: hours }, (_, index) => ({
    start: opens.add({ hours: index }),
    end: opens.add({ hours: index + 1 }),
  }));
}

/**
 * A slot or booking has started once its start is at or before now. Availability does not offer
 * a started slot, and a booking cannot start then.
 */
export function hasStarted(start: Temporal.Instant, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(start, now) <= 0;
}

/**
 * A slot's status, given the time ranges of the court's confirmed bookings. In the order booking
 * refuses a time: a started slot fails the rules (ALREADY_STARTED) before the database sees
 * whether it is taken (SLOT_TAKEN).
 */
export function slotStatus(
  slot: TimeRange,
  booked: readonly TimeRange[],
  now: Temporal.Instant,
): SlotStatus {
  if (hasStarted(slot.start, now)) {
    return SlotStatus.STARTED;
  }

  return booked.some((range) => areOverlapping(range, slot))
    ? SlotStatus.TAKEN
    : SlotStatus.AVAILABLE;
}
