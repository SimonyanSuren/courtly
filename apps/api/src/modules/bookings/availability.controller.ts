import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { CourtError } from '../courts/courts.errors';
import { Role } from '../users/domain/role';
import { BookingsService } from './bookings.service';
import { type DateQueryDto, dateQuerySchema } from './dto/date-query.dto';
import { type AvailabilityResponse, toAvailabilityResponse } from './dto/responses';

/**
 * A court's free hours. The path is under courts, but the answer needs bookings, and bookings
 * depend on courts, not the other way round: so the route lives here.
 */
@Roles([Role.USER])
@Controller('courts')
export class AvailabilityController {
  constructor(private readonly bookings: BookingsService) {}

  @Get(':id/availability')
  async availability(
    // An id that is not a UUID names no court: the same 404 as GET /api/courts/:id.
    @Param('id', new ParseUUIDPipe({ exceptionFactory: CourtError.notFound })) id: string,
    @Query({ schema: dateQuerySchema }) { date }: DateQueryDto,
  ): Promise<AvailabilityResponse> {
    return toAvailabilityResponse(await this.bookings.availability(id, date));
  }
}
