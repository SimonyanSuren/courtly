import { setTimeout as sleep } from 'node:timers/promises';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { type Response } from 'supertest';

import { type Database } from '../src/platform/database/database';

/**
 * Polls until one of the API's connections waits for a lock while running `statement`. Each poll
 * is a transaction of its own: pg_stat_activity keeps one snapshot for a whole transaction.
 */
async function untilTheApiWaits(db: Database, statement: string): Promise<void> {
  const running = `${statement}%`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { rows } = await db.execute<{ waiting: number }>(sql`
      select count(*)::int as waiting from pg_stat_activity
      where datname = current_database() and application_name = 'courtly-api'
        and wait_event_type = 'Lock' and query like ${running}`);

    if (rows[0]?.waiting === 1) {
      return;
    }

    await sleep(20);
  }

  throw new Error(`The API never waited for the other transaction while running ${statement}.`);
}

/**
 * Runs `write` on a connection of its own in a transaction it keeps open, sends the API's
 * request, waits until the API's `statement` waits for that transaction, then ends it with `end`
 * and returns the API's answer.
 */
export async function whileUncommitted(
  db: Database,
  {
    write,
    statement,
    end,
  }: {
    write: (other: Database) => Promise<unknown>;
    statement: string;
    end: 'commit' | 'rollback';
  },
  send: () => Promise<Response>,
): Promise<Response> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('begin');
    await write(drizzle({ client }));
    const response = send();
    await untilTheApiWaits(db, statement);
    await client.query(end);

    return await response;
  } finally {
    await client.end();
  }
}
