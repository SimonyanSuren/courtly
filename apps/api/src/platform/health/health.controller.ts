import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database';
import { Public } from '../http/public.decorator';

/** Liveness for Docker and monitoring: the API answers and can reach its database. */
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.db.execute(sql`select 1`);
    } catch (error) {
      throw new ServiceUnavailableException('The database is not reachable.', { cause: error });
    }

    return { status: 'ok' };
  }
}
