/** The last moment a booking can be cancelled: exactly 2 real hours before it starts. */
export function cancellableUntil(start: Temporal.Instant): Temporal.Instant {
  return start.subtract({ hours: 2 });
}

/**
 * A booking can be cancelled up to and including exactly 2 hours before it starts: one that
 * starts at 18:00 until 16:00:00.000, not a moment later. The 2 hours are real hours, even when
 * the clocks change in between.
 */
export function canCancel(start: Temporal.Instant, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, cancellableUntil(start)) <= 0;
}
