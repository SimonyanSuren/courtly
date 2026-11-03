import { Module } from '@nestjs/common';

import { CourtsController } from './courts.controller';
import { CourtsRepository } from './courts.repository';
import { CourtsService } from './courts.service';

/** The facility's courts: admins manage them, users see the active ones. */
@Module({
  controllers: [CourtsController],
  providers: [CourtsService, CourtsRepository],
  // Bookings read courts through the service, so the rule that hides inactive courts from users
  // stays in one place.
  exports: [CourtsService],
})
export class CourtsModule {}
