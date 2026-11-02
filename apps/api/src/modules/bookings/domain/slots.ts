import { type OpeningHours, openingTimes } from '../../courts/domain/opening-hours';

/** The time from start, included, to end, excluded. */
export interface TimeRange {
  readonly start: Temporal.Instant;
  readonly end: Temporal.Instant;
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
