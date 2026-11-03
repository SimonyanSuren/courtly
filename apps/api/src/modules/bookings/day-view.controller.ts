import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/domain/role';
import { BookingsService } from './bookings.service';
import { type DateQueryDto, dateQuerySchema } from './dto/date-query.dto';
import { type DayViewResponse, toDayViewResponse } from './dto/responses';

/** The admins' view of one day across every court. */
@Roles([Role.ADMIN])
@Controller('admin/bookings')
export class DayViewController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  async dayView(
    @Query({ schema: dateQuerySchema }) { date }: DateQueryDto,
  ): Promise<DayViewResponse> {
    return toDayViewResponse(await this.bookings.dayView(date));
  }
}
