import { Module } from '@nestjs/common';

import { Clock } from '../../platform/clock/clock';
import { CourtsModule } from '../courts/courts.module';
import { AvailabilityController } from './availability.controller';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';
import { DayViewController } from './day-view.controller';

/** Users book and cancel courts and see their free hours; admins see each day's bookings. */
@Module({
  imports: [CourtsModule],
  controllers: [BookingsController, AvailabilityController, DayViewController],
  providers: [BookingsService, BookingsRepository, Clock],
})
export class BookingsModule {}
