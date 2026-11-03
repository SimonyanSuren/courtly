import { type NestExpressApplication } from '@nestjs/platform-express';

import { courts } from '../src/modules/courts/courts.schema';
import { Clock } from '../src/platform/clock/clock';
import { type Database } from '../src/platform/database/database';
import { createTestApp } from './create-test-app';

/** A clock the test sets by hand, given to the app in place of the real one. */
export class TestClock {
  private current: Temporal.Instant;

  constructor(start: string) {
    this.current = Temporal.Instant.from(start);
  }

  now(): Temporal.Instant {
    return this.current;
  }

  set(moment: string): void {
    this.current = Temporal.Instant.from(moment);
  }
}

/** Boots the app with its clock replaced by `clock`. */
export async function createTestAppWithClock(clock: TestClock): Promise<NestExpressApplication> {
  return createTestApp({}, (builder) => builder.overrideProvider(Clock).useValue(clock));
}

/** Inserts a court, open from 08:00 to 22:00 at €24 an hour unless told otherwise; its id. */
export async function insertCourt(
  db: Database,
  fields: Partial<typeof courts.$inferInsert> = {},
): Promise<string> {
  const [court] = await db
    .insert(courts)
    .values({
      name: 'Padel 1',
      sport: 'padel',
      hourlyPriceCents: 2400,
      openingHour: 8,
      closingHour: 22,
      ...fields,
    })
    .returning({ id: courts.id });

  if (!court) {
    throw new Error('The insert returned no court.');
  }

  return court.id;
}
