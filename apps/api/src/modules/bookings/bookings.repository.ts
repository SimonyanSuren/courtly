import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, gte, lt } from 'drizzle-orm';

import { DATABASE, type Database } from '../../platform/database/database';
import { type Court, courts } from '../courts/courts.schema';
import { type PublicUser, users } from '../users/users.schema';
import { bookings } from './bookings.schema';
import { BookingStatus } from './domain/booking';
import { type TimeRange } from './domain/slots';

/** A booking with the court it is for. Its times are instants, as the rules take them. */
export interface Booking {
  id: string;
  court: Pick<Court, 'id' | 'name' | 'sport'>;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  hours: number;
  priceCents: number;
  status: BookingStatus;
  createdAt: Temporal.Instant;
  cancelledAt: Temporal.Instant | null;
}

/** A booking for the day view: also who made it. */
export interface AdminBooking extends Booking {
  user: Pick<PublicUser, 'id' | 'name' | 'email'>;
}

interface NewBooking {
  userId: string;
  courtId: string;
  range: TimeRange;
  hours: number;
  priceCents: number;
}

// The pg driver reads and writes timestamptz as Date; past this file, the module uses Temporal.
const toDate = (instant: Temporal.Instant): Date => new Date(instant.epochMilliseconds);
const toInstant = (date: Date): Temporal.Instant =>
  Temporal.Instant.fromEpochMilliseconds(date.getTime());

/** The columns of a Booking, so every query reads what the module uses and nothing more. */
const bookingColumns = {
  id: bookings.id,
  court: { id: courts.id, name: courts.name, sport: courts.sport },
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  hours: bookings.hours,
  priceCents: bookings.priceCents,
  status: bookings.status,
  createdAt: bookings.createdAt,
  cancelledAt: bookings.cancelledAt,
};

type BookingRow = Omit<Booking, 'startsAt' | 'endsAt' | 'createdAt' | 'cancelledAt'> & {
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  cancelledAt: Date | null;
};

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    court: row.court,
    startsAt: toInstant(row.startsAt),
    endsAt: toInstant(row.endsAt),
    hours: row.hours,
    priceCents: row.priceCents,
    status: row.status,
    createdAt: toInstant(row.createdAt),
    cancelledAt: row.cancelledAt === null ? null : toInstant(row.cancelledAt),
  };
}

@Injectable()
export class BookingsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Inserts a confirmed booking. One whose time overlaps another confirmed booking of the court
   * breaks BOOKINGS_NO_OVERLAP: the database decides, even for two inserts at the same instant.
   */
  async create({
    range,
    ...booking
  }: NewBooking): Promise<{ id: string; createdAt: Temporal.Instant }> {
    const [created] = await this.db
      .insert(bookings)
      .values({ ...booking, startsAt: toDate(range.start), endsAt: toDate(range.end) })
      .returning({ id: bookings.id, createdAt: bookings.createdAt });

    if (!created) {
      throw new Error('The insert returned no booking.');
    }

    return { id: created.id, createdAt: toInstant(created.createdAt) };
  }

  /** The booking with this id, if it is this user's. */
  async findForUser(id: string, userId: string): Promise<Booking | undefined> {
    const [row] = await this.db
      .select(bookingColumns)
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .where(and(eq(bookings.id, id), eq(bookings.userId, userId)));

    return row === undefined ? undefined : toBooking(row);
  }

  /** A user's bookings, cancelled ones included, by start; uuidv7 ids break ties by creation. */
  async listForUser(userId: string): Promise<Booking[]> {
    const rows = await this.db
      .select(bookingColumns)
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .where(eq(bookings.userId, userId))
      .orderBy(asc(bookings.startsAt), asc(bookings.id));

    return rows.map(toBooking);
  }

  /**
   * Cancels the booking at `at` if it is still confirmed; false if it was not. Of two cancels at
   * once, the second waits for the first's row lock, then finds the status changed and updates
   * nothing.
   */
  async cancel(id: string, at: Temporal.Instant): Promise<boolean> {
    const cancelled = await this.db
      .update(bookings)
      .set({ status: BookingStatus.CANCELLED, cancelledAt: toDate(at) })
      .where(and(eq(bookings.id, id), eq(bookings.status, BookingStatus.CONFIRMED)))
      .returning({ id: bookings.id });

    return cancelled.length > 0;
  }

  /** The times of the court's confirmed bookings that overlap `range`. */
  async confirmedTimes(courtId: string, range: TimeRange): Promise<TimeRange[]> {
    const [start, end] = [toDate(range.start), toDate(range.end)];
    const rows = await this.db
      .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.courtId, courtId),
          eq(bookings.status, BookingStatus.CONFIRMED),
          lt(bookings.startsAt, end),
          gt(bookings.endsAt, start),
        ),
      );

    return rows.map((row) => ({ start: toInstant(row.startsAt), end: toInstant(row.endsAt) }));
  }

  /**
   * Every booking that starts within `range`, at any court, active or not, cancelled ones
   * included: by court name, then start, then creation.
   */
  async listStartingIn(range: TimeRange): Promise<AdminBooking[]> {
    const [start, end] = [toDate(range.start), toDate(range.end)];
    const rows = await this.db
      .select({ ...bookingColumns, user: { id: users.id, name: users.name, email: users.email } })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(and(gte(bookings.startsAt, start), lt(bookings.startsAt, end)))
      .orderBy(asc(courts.name), asc(bookings.startsAt), asc(bookings.id));

    return rows.map((row) => ({ ...toBooking(row), user: row.user }));
  }
}
