import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE, type Database } from './database';
import { databaseConfig } from './database.config';
import { createPool } from './pool';

/** One connection pool for the whole API, exposed through Drizzle. Global: every module needs it. */
@Global()
@Module({
  providers: [
    // The Pool class itself is the token, so tests can replace it with overrideProvider(Pool).
    { provide: Pool, inject: [databaseConfig.KEY], useFactory: createPool },
    {
      provide: DATABASE,
      inject: [Pool],
      useFactory: (pool: Pool): Database => drizzle({ client: pool }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(Pool) private readonly pool: Pool) {}

  // Runs on app.close() and, with shutdown hooks, on SIGTERM: open connections close cleanly.
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
