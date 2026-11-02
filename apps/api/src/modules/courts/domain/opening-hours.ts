/** The facility's time zone. Opening hours and calendar dates are local to it. */
export const FACILITY_TIME_ZONE = 'Europe/Lisbon';

/** A court's daily opening hours as whole local hours: 8 and 23 mean 08:00 to 23:00. */
export interface OpeningHours {
  readonly openingHour: number;
  /** 24 is the midnight that ends the day. */
  readonly closingHour: number;
}

/**
 * Whole hours from 0 to 24, opening before closing. Slots then line up with the hour, and a
 * court's day never crosses midnight.
 */
export function isValidOpeningHours({ openingHour, closingHour }: OpeningHours): boolean {
  return (
    Number.isSafeInteger(openingHour) &&
    Number.isSafeInteger(closingHour) &&
    openingHour >= 0 &&
    openingHour < closingHour &&
    closingHour <= 24
  );
}

function localHourOn(date: Temporal.PlainDate, hour: number): Temporal.Instant {
  return (
    date
      .toPlainDateTime()
      // A time without a zone: adding 24 hours gives 00:00 of the next day.
      .add({ hours: hour })
      // When the clocks go forward, 'compatible' moves a skipped time forward by the jump, to the
      // moment the clock jumps past it; when they go back, it takes the first of the two times.
      .toZonedDateTime(FACILITY_TIME_ZONE, { disambiguation: 'compatible' })
      .toInstant()
  );
}

/**
 * When a court opens and closes on a date. It is open while the facility's clock shows a time
 * from the opening hour up to the closing hour, so on the days the clocks change it opens or
 * closes the first moment the clock shows that hour or later. Expects valid opening hours.
 */
export function openingTimes(
  openingHours: OpeningHours,
  date: Temporal.PlainDate,
): { opens: Temporal.Instant; closes: Temporal.Instant } {
  return {
    opens: localHourOn(date, openingHours.openingHour),
    closes: localHourOn(date, openingHours.closingHour),
  };
}
