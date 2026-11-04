import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { ApiRoute } from '../../platform/api-docs/api-route.decorator';
import { HttpError } from '../../platform/http/http.errors';
import { AuthError } from '../auth/auth.errors';
import { Roles } from '../auth/decorators/roles.decorator';
import { CourtError } from '../courts/courts.errors';
import { Role } from '../users/domain/role';
import { BookingsService } from './bookings.service';
import {
  type AvailabilityResponse,
  availabilitySchema,
  toAvailabilityResponse,
} from './dto/availability.response';
import { type DateQueryDto, dateQuerySchema } from './dto/date-query.dto';

/**
 * A court's free hours. The path is under courts, but the answer needs bookings, and bookings
 * depend on courts, not the other way round: so the route lives here.
 */
@Roles([Role.USER])
@Controller('courts')
export class AvailabilityController {
  constructor(private readonly bookings: BookingsService) {}

  @ApiRoute({
    summary: "A court's slots on a day (user)",
    response: availabilitySchema,
    description: 'One slot per hour from opening to closing, in order.',
    errors: [
      HttpError.validationFailed([
        { in: 'query', path: 'date', message: 'Must be a date such as 2026-11-05.' },
      ]),
      AuthError.forbidden(),
      CourtError.notFound(),
    ],
  })
  @Get(':id/availability')
  async availability(
    // An id that is not a UUID names no court: the same 404 as GET /api/courts/:id.
    @Param('id', new ParseUUIDPipe({ exceptionFactory: CourtError.notFound })) id: string,
    @Query({ schema: dateQuerySchema }) { date }: DateQueryDto,
  ): Promise<AvailabilityResponse> {
    return toAvailabilityResponse(await this.bookings.availability(id, date));
  }
}
