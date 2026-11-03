import { PasswordHasher } from './modules/auth/password-hasher';
import { bookings } from './modules/bookings/bookings.schema';
import { BookingStatus, checkBooking } from './modules/bookings/domain/booking';
import { courts } from './modules/courts/courts.schema';
import { Sport } from './modules/courts/domain/court';
import { FACILITY_TIME_ZONE } from './modules/courts/domain/opening-hours';
import { Role } from './modules/users/domain/role';
import { users } from './modules/users/users.schema';
import { type Database } from './platform/database/database';

/** What seedDemoData() did. */
export const SeedResult = { SEEDED: 'seeded', SKIPPED: 'skipped' } as const;

export type SeedResult = (typeof SeedResult)[keyof typeof SeedResult];

/** The password of every demo account. Not a secret: the demo exists to be tried. */
// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- a published demo credential
export const DEMO_PASSWORD = 'courtly-demo';

const ADMIN = 'admin@example.com';
const ANA = 'ana@example.com';
const RUI = 'rui@example.com';

export const DEMO_USERS = [
  { email: ADMIN, name: 'Marta Costa', role: Role.ADMIN },
  { email: ANA, name: 'Ana Silva', role: Role.USER },
  { email: RUI, name: 'Rui Santos', role: Role.USER },
] as const satisfies ReadonlyArray<Pick<typeof users.$inferInsert, 'email' | 'name' | 'role'>>;

const DEMO_COURTS = [
  {
    name: 'Padel 1',
    sport: Sport.PADEL,
    hourlyPriceCents: 2400,
    openingHour: 8,
    closingHour: 23,
    active: true,
  },
  {
    name: 'Padel 2',
    sport: Sport.PADEL,
    hourlyPriceCents: 2200,
    openingHour: 8,
    closingHour: 23,
    active: true,
  },
  {
    name: 'Tennis 1',
    sport: Sport.TENNIS,
    hourlyPriceCents: 1800,
    openingHour: 7,
    closingHour: 22,
    active: true,
  },
  {
    name: 'Squash 1',
    sport: Sport.SQUASH,
    hourlyPriceCents: 1200,
    openingHour: 9,
    closingHour: 21,
    active: true,
  },
  // Inactive, with a past booking: deactivating a court keeps its bookings.
  {
    name: 'Badminton 1',
    sport: Sport.BADMINTON,
    hourlyPriceCents: 1000,
    openingHour: 10,
    closingHour: 20,
    active: false,
  },
] as const satisfies ReadonlyArray<Omit<typeof courts.$inferInsert, 'id' | 'createdAt'>>;

interface DemoBooking {
  /** Calendar days from today on the facility's clock: -1 is yesterday, 1 tomorrow. */
  readonly day: number;
  readonly court: (typeof DEMO_COURTS)[number]['name'];
  readonly user: typeof ANA | typeof RUI;
  /** The hour on the facility's clock it starts at. */
  readonly hour: number;
  readonly hours: 1 | 2;
  readonly cancelled?: boolean;
}

export const DEMO_BOOKINGS: readonly DemoBooking[] = [
  { day: -7, court: 'Badminton 1', user: ANA, hour: 18, hours: 1 },
  { day: -3, court: 'Tennis 1', user: RUI, hour: 10, hours: 2 },
  { day: -2, court: 'Padel 1', user: ANA, hour: 19, hours: 2, cancelled: true },
  { day: -1, court: 'Squash 1', user: ANA, hour: 12, hours: 1 },
  { day: -1, court: 'Padel 1', user: RUI, hour: 20, hours: 1 },
  // Today too: the admins' day view opens on today. Each is past or upcoming by the time of day.
  { day: 0, court: 'Padel 1', user: RUI, hour: 10, hours: 1 },
  { day: 0, court: 'Tennis 1', user: ANA, hour: 18, hours: 2 },
  { day: 1, court: 'Padel 1', user: ANA, hour: 18, hours: 2 },
  { day: 1, court: 'Padel 2', user: RUI, hour: 18, hours: 1 },
  { day: 1, court: 'Tennis 1', user: RUI, hour: 9, hours: 1, cancelled: true },
  { day: 1, court: 'Squash 1', user: ANA, hour: 12, hours: 1 },
  { day: 2, court: 'Padel 2', user: RUI, hour: 19, hours: 2 },
  { day: 2, court: 'Tennis 1', user: ANA, hour: 10, hours: 1 },
];

/** Accounts and courts date from this long before now, before any booking made with them. */
const SEEDED_HOURS_AGO = 30 * 24;
/** A booking is made this long before it starts, or before now if it starts later. */
const BOOKED_HOURS_AHEAD = 3 * 24;
/** A cancelled booking was cancelled this long after it was made. */
const CANCELLED_HOURS_LATER = 24;

// The pg driver writes timestamptz as Date.
const toDate = (instant: Temporal.Instant): Date => new Date(instant.epochMilliseconds);

/** The inserted row for a demo user's email or a demo court's name. */
function found<T>(rows: ReadonlyMap<string, T>, key: string): T {
  const row = rows.get(key);

  if (row === undefined) {
    throw new Error(`The demo data has no row for ${key}.`);
  }

  return row;
}

function bookingRow(
  booking: DemoBooking,
  { today, now }: { today: Temporal.PlainDate; now: Temporal.Instant },
  { userId, court }: { userId: string; court: typeof courts.$inferSelect },
): typeof bookings.$inferInsert {
  const start = today
    .add({ days: booking.day })
    .toPlainDateTime({ hour: booking.hour })
    .toZonedDateTime(FACILITY_TIME_ZONE)
    .toInstant();
  // A past booking was made before it happened, an upcoming one before now.
  const createdAt = (Temporal.Instant.compare(start, now) < 0 ? start : now).subtract({
    hours: BOOKED_HOURS_AHEAD,
  });
  // The rules a new booking must pass, checked at the time it was made: 1 or 2 hours, on the
  // hour and within the court's opening hours on that date, in real hours when the clocks change.
  const check = checkBooking({ start, hours: booking.hours }, court, createdAt);

  if (!check.ok) {
    throw new Error(`The demo booking of ${court.name} at ${start.toString()}: ${check.reason}.`);
  }

  // A day after it was made: still before now, and at least 2 days before it starts, while
  // cancelling is allowed (until 2 hours before).
  const cancelledAt = booking.cancelled ? createdAt.add({ hours: CANCELLED_HOURS_LATER }) : null;

  return {
    userId,
    courtId: court.id,
    startsAt: toDate(check.range.start),
    endsAt: toDate(check.range.end),
    hours: booking.hours,
    // The price it was booked at, as the API stores it.
    priceCents: court.hourlyPriceCents * booking.hours,
    status: cancelledAt === null ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED,
    createdAt: toDate(createdAt),
    cancelledAt: cancelledAt === null ? null : toDate(cancelledAt),
  };
}

/**
 * Fills a fresh database with the demo accounts, courts and bookings, placed on calendar days
 * around `now` in the facility's time zone, so a demo always has past and upcoming bookings.
 * All or nothing, in one transaction. A database with any user is not fresh: then it changes
 * nothing, so running it again, as every `docker compose up` does, keeps the data as it is.
 */
export async function seedDemoData(db: Database, now: Temporal.Instant): Promise<SeedResult> {
  return db.transaction(async (tx) => {
    const [anyUser] = await tx.select({ id: users.id }).from(users).limit(1);

    if (anyUser) {
      return SeedResult.SKIPPED;
    }

    const seededAt = toDate(now.subtract({ hours: SEEDED_HOURS_AGO }));
    const hasher = new PasswordHasher();
    const accounts = await Promise.all(
      DEMO_USERS.map(async (user) => ({
        ...user,
        // Each hash has its own salt, so equal passwords still get different hashes.
        passwordHash: await hasher.hash(DEMO_PASSWORD),
        createdAt: seededAt,
      })),
    );
    const insertedUsers = await tx
      .insert(users)
      .values(accounts)
      .returning({ id: users.id, email: users.email });
    const insertedCourts = await tx
      .insert(courts)
      .values(DEMO_COURTS.map((court) => ({ ...court, createdAt: seededAt })))
      .returning();
    const userIds = new Map(insertedUsers.map(({ email, id }) => [email, id]));
    const courtsByName = new Map(insertedCourts.map((court) => [court.name, court]));

    const today = now.toZonedDateTimeISO(FACILITY_TIME_ZONE).toPlainDate();
    await tx
      .insert(bookings)
      .values(
        DEMO_BOOKINGS.map((booking) =>
          bookingRow(
            booking,
            { today, now },
            { userId: found(userIds, booking.user), court: found(courtsByName, booking.court) },
          ),
        ),
      );

    return SeedResult.SEEDED;
  });
}
