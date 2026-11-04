import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { ApiRoute } from '../api-docs/api-route.decorator';
import { DATABASE, type Database } from '../database/database';
import { Public } from '../http/public.decorator';

const healthSchema = z.object({ status: z.literal('ok') });

const databaseUnreachable = (cause?: unknown): ServiceUnavailableException =>
  new ServiceUnavailableException('The database is not reachable.', { cause });

/** Liveness for Docker and monitoring: the API answers and can reach its database. */
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @ApiRoute({
    summary: 'Health check (public)',
    response: healthSchema,
    description: 'The API answers and can reach its database.',
    errors: [databaseUnreachable()],
    isPublic: true,
  })
  @Get()
  async check(): Promise<z.output<typeof healthSchema>> {
    try {
      await this.db.execute(sql`select 1`);
    } catch (error) {
      throw databaseUnreachable(error);
    }

    return { status: 'ok' };
  }
}
