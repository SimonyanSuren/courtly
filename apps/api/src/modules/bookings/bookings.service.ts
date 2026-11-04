import { Injectable } from '@nestjs/common';

import { Clock } from '../../platform/clock/clock';
import { isExclusionViolation } from '../../platform/database/errors';
import { type Court } from '../courts/courts.schema';
import { CourtsService } from '../courts/courts.service';
import { Role } from '../users/domain/role';
import { BookingError } from './bookings.errors';
import { type AdminBooking, type Booking, BookingsRepository } from './bookings.repository';
import { BOOKINGS_NO_OVERLAP } from './bookings.schema';
import { BookingStatus, checkBooking } from './domain/booking';
import { canCancel } from './domain/cancellation';
import { expectedRevenueCents } from './domain/revenue';
import { calendarDay, daySlots, type SlotStatus, slotStatus, type TimeRange } from './domain/slots';
import { type NewBookingDto } from './dto/new-booking.dto';

// What the service answers, in Temporal values; a file in dto/ writes each one as JSON.

export interface MyBookings {
  /** Not ended yet, soonest first. */
  upcoming: Booking[];
  /** Ended, most recent first. */
  past: Booking[];
}

interface Slot extends TimeRange {
  status: SlotStatus;
}

export interface Availability {
  court: Court;
  date: Temporal.PlainDate;
  slots: Slot[];
}

export interface DayView {
  date: Temporal.PlainDate;
  bookings: AdminBooking[];
  expectedRevenueCents: number;
}

/**
 * Waits for the insert and answers SLOT_TAKEN when it overlaps a confirmed booking of the court.
 * The exclusion constraint decides, not an earlier lookup: a lookup cannot see a booking another
 * request has inserted but not yet committed, so two requests could both find the slot free.
 */
async function rejectingTakenSlot<T>(insert: Promise<T>): Promise<T> {
  try {
    return await insert;
  } catch (error) {
    if (isExclusionViolation(error, BOOKINGS_NO_OVERLAP)) {
      throw BookingError.slotTaken();
    }

    throw error;
  }
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly courts: CourtsService,
    private readonly clock: Clock,
  ) {}

  async book(userId: string, { courtId, startsAt, hours }: NewBookingDto): Promise<Booking> {
    // Only users book, and to a user an inactive court does not exist.
    const court = await this.courts.get(courtId, Role.USER);
    const check = checkBooking({ start: startsAt, hours }, court, this.clock.now());

    if (!check.ok) {
      throw BookingError.rejected(check.reason);
    }

    const priceCents = court.hourlyPriceCents * hours;

    return rejectingTakenSlot(
      this.bookings.create({ userId, courtId, range: check.range, hours, priceCents }),
    );
  }

  /** The user's own bookings, cancelled ones included. One that has not ended is upcoming. */
  async listMine(userId: string): Promise<MyBookings> {
    const now = this.clock.now();
    const mine = await this.bookings.listForUser(userId);
    const hasEnded = ({ endsAt }: Booking): boolean => Temporal.Instant.compare(endsAt, now) <= 0;

    return {
      upcoming: mine.filter((booking) => !hasEnded(booking)),
      past: mine.filter(hasEnded).toReversed(),
    };
  }

  async cancel(id: string, userId: string): Promise<Booking> {
    // Another user's booking is answered as if it did not exist.
    const booking = await this.bookings.findForUser(id, userId);

    if (!booking) {
      throw BookingError.notFound();
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw BookingError.alreadyCancelled();
    }

    const now = this.clock.now();

    if (!canCancel(booking.startsAt, now)) {
      throw BookingError.cancellationWindowClosed();
    }

    const cancelled = await this.bookings.cancel(id, now);

    // Another cancel may have changed the booking since it was read.
    if (!cancelled) {
      throw BookingError.alreadyCancelled();
    }

    return cancelled;
  }

  /**
   * The court's slots on a date, from the same list of slots booking checks against, so a slot
   * shown as available is one booking accepts.
   */
  async availability(courtId: string, date: Temporal.PlainDate): Promise<Availability> {
    const court = await this.courts.get(courtId, Role.USER);
    const booked = await this.bookings.confirmedTimes(courtId, calendarDay(date));
    const now = this.clock.now();

    return {
      court,
      date,
      slots: daySlots(court, date).map((slot) => ({
        ...slot,
        status: slotStatus(slot, booked, now),
      })),
    };
  }

  /** Every booking that starts on a date, and what the confirmed ones should earn. */
  async dayView(date: Temporal.PlainDate): Promise<DayView> {
    const booked = await this.bookings.listStartingIn(calendarDay(date));

    return {
      date,
      bookings: booked,
      // Summed from the rows listed, so the total always matches the bookings shown.
      expectedRevenueCents: expectedRevenueCents(booked),
    };
  }
}
