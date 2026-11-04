import { Controller, Get, Query } from '@nestjs/common';

import { ApiRoute } from '../../platform/api-docs/api-route.decorator';
import { HttpError } from '../../platform/http/http.errors';
import { AuthError } from '../auth/auth.errors';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/domain/role';
import { BookingsService } from './bookings.service';
import { type DateQueryDto, dateQuerySchema } from './dto/date-query.dto';
import { type DayViewResponse, dayViewSchema, toDayViewResponse } from './dto/day-view.response';

/** The admins' view of one day across every court. */
@Roles([Role.ADMIN])
@Controller('admin/bookings')
export class DayViewController {
  constructor(private readonly bookings: BookingsService) {}

  @ApiRoute({
    summary: 'Every booking that starts on a day, at any court (admin)',
    response: dayViewSchema,
    description: 'By court name, then start time; cancelled bookings are listed too.',
    errors: [
      HttpError.validationFailed([
        { in: 'query', path: 'date', message: 'Must be a date such as 2026-11-05.' },
      ]),
      AuthError.forbidden(),
    ],
  })
  @Get()
  async dayView(
    @Query({ schema: dateQuerySchema }) { date }: DateQueryDto,
  ): Promise<DayViewResponse> {
    return toDayViewResponse(await this.bookings.dayView(date));
  }
}
