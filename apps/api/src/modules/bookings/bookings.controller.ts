import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/domain/role';
import { type PublicUser } from '../users/users.schema';
import { BookingError } from './bookings.errors';
import { BookingsService } from './bookings.service';
import { type NewBookingDto, newBookingSchema } from './dto/new-booking.dto';
import {
  type BookingResponse,
  type MyBookingsResponse,
  toBookingResponse,
  toMyBookingsResponse,
} from './dto/responses';

/** A user's own bookings. Admins do not book or cancel. */
@Roles([Role.USER])
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  async book(
    @Body({ schema: newBookingSchema }) booking: NewBookingDto,
    @CurrentUser() user: PublicUser,
  ): Promise<BookingResponse> {
    return toBookingResponse(await this.bookings.book(user.id, booking));
  }

  @Get()
  async listMine(@CurrentUser() user: PublicUser): Promise<MyBookingsResponse> {
    return toMyBookingsResponse(await this.bookings.listMine(user.id));
  }

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
