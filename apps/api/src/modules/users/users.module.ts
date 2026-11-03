import { Module } from '@nestjs/common';

import { UsersRepository } from './users.repository';

/** Who the people using Courtly are. Accounts are seeded; there is no sign-up. */
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
