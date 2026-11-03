import { HttpStatus } from '@nestjs/common';

import { ApiError } from '../../platform/http/api-error';
import { type BookingRejection } from './domain/booking';

/** The sentence a user reads for each booking rule; the rule's name is the error code. */
const REJECTIONS: Record<BookingRejection, string> = {
  // The request schema already answers 400 for any other number of hours, so this one only
  // keeps the list complete.
  INVALID_DURATION: 'A booking lasts 1 or 2 hours.',
  NOT_ON_THE_HOUR: 'A booking must start on the hour.',
  OUTSIDE_OPENING_HOURS: 'The court is not open for all of that time.',
  ALREADY_STARTED: 'That time has already started.',
};

/**
 * Every error the bookings module answers with: its status, its stable code and the sentence a
 * user reads, in one place. Functions, so each throw gets a new error with its own stack trace.
 */
export const BookingError = {
  /** A booking rule is broken: the request is well formed, but the booking cannot be made. */
  rejected: (reason: BookingRejection): ApiError =>
    new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, reason, REJECTIONS[reason]),
  slotTaken: (): ApiError =>
    new ApiError(
      HttpStatus.CONFLICT,
      'SLOT_TAKEN',
      'Someone else booked this court for that time.',
    ),
  /** For an unknown id, and for another user's booking. */
  notFound: (): ApiError =>
    new ApiError(HttpStatus.NOT_FOUND, 'BOOKING_NOT_FOUND', 'There is no such booking.'),
  alreadyCancelled: (): ApiError =>
    new ApiError(
      HttpStatus.CONFLICT,
      'BOOKING_ALREADY_CANCELLED',
      'This booking is already cancelled.',
    ),
  cancellationWindowClosed: (): ApiError =>
    new ApiError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'CANCELLATION_WINDOW_CLOSED',
      'A booking can be cancelled until 2 hours before it starts.',
    ),
};
