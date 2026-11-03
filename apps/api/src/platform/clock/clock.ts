import { Injectable } from '@nestjs/common';

/**
 * The time now, for every rule that depends on it. A provider, so a test can fix the time and
 * check a rule at its exact boundary: `overrideProvider(Clock).useValue({ now: () => instant })`.
 */
@Injectable()
export class Clock {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  }
}
