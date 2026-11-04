import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { ApiRoute } from '../../platform/api-docs/api-route.decorator';
import { HttpError } from '../../platform/http/http.errors';
import { AuthError } from '../auth/auth.errors';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CourtError } from '../courts/courts.errors';
import { Role } from '../users/domain/role';
import { type PublicUser } from '../users/users.schema';
import { BookingError } from './bookings.errors';
import { BookingsService } from './bookings.service';
import { type BookingResponse, bookingSchema, toBookingResponse } from './dto/booking.response';
import {
  type MyBookingsResponse,
  myBookingsSchema,
  toMyBookingsResponse,
} from './dto/my-bookings.response';
import { type NewBookingDto, newBookingSchema } from './dto/new-booking.dto';

/** A user's own bookings. Admins do not book or cancel. */
@Roles([Role.USER])
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @ApiRoute({
    summary: 'Book a court (user)',
    status: HttpStatus.CREATED,
    response: bookingSchema,
    description: 'The booking, confirmed.',
    errors: [
      HttpError.validationFailed([{ in: 'body', path: 'hours', message: 'Must be 1 or 2.' }]),
      AuthError.forbidden(),
      CourtError.notFound(),
      BookingError.slotTaken(),
      BookingError.rejected('NOT_ON_THE_HOUR'),
      BookingError.rejected('OUTSIDE_OPENING_HOURS'),
      BookingError.rejected('ALREADY_STARTED'),
    ],
  })
  @Post()
  async book(
    @Body({ schema: newBookingSchema }) booking: NewBookingDto,
    @CurrentUser() user: PublicUser,
  ): Promise<BookingResponse> {
    return toBookingResponse(await this.bookings.book(user.id, booking));
  }

  @ApiRoute({
    summary: 'My bookings, cancelled ones included (user)',
    response: myBookingsSchema,
    description: "The caller's own bookings.",
    errors: [AuthError.forbidden()],
  })
  @Get()
  async listMine(@CurrentUser() user: PublicUser): Promise<MyBookingsResponse> {
    return toMyBookingsResponse(await this.bookings.listMine(user.id));
  }

  @ApiRoute({
    summary: 'Cancel a booking, up to 2 hours before it starts (user)',
    response: bookingSchema,
    description: 'The booking, now cancelled.',
    errors: [
      AuthError.forbidden(),
      BookingError.notFound(),
      BookingError.alreadyCancelled(),
      BookingError.cancellationWindowClosed(),
    ],
  })
  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    // As for courts: an id that is not a UUID names no booking, so it gets the same 404.
    @Param('id', new ParseUUIDPipe({ exceptionFactory: BookingError.notFound })) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<BookingResponse> {
    return toBookingResponse(await this.bookings.cancel(id, user.id));
  }
}
