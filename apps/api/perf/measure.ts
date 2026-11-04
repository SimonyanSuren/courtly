import { type Logger } from 'drizzle-orm';
import { type Pool } from 'pg';

/** A statement as Drizzle handed it to the driver: its SQL and its parameters, already encoded. */
export interface SentQuery {
  sql: string;
  params: unknown[];
}

/**
 * A Drizzle logger that keeps what the repository sends, so the plans below are of the exact
 * statement the API runs, not of a copy typed by hand.
 */
export class QueryRecorder implements Logger {
  private sent: SentQuery[] = [];

  logQuery(query: string, params: unknown[]): void {
    this.sent.push({ sql: query, params });
  }

  /** The one statement `run` sends. */
  async only(run: () => Promise<unknown>): Promise<SentQuery> {
    this.sent = [];
    await run();
    const [query, ...others] = this.sent;

    if (query === undefined || others.length > 0) {
      throw new Error(`Expected one statement, got ${String(this.sent.length)}.`);
    }

    return query;
  }
}

export interface Timing {
  medianMs: number;
  p95Ms: number;
}

/** The value at or below which `share` of the sorted values lie (the nearest-rank method). */
function percentile(sorted: readonly number[], share: number): number {
  const value = sorted[Math.ceil(share * sorted.length) - 1];

  if (value === undefined) {
    throw new Error('No values to take a percentile of.');
  }

  return value;
}

/**
 * Times `runs` calls of `run`, one after the other, each given its index. `warmUp` calls before
 * them are not timed: they fill PostgreSQL's buffer cache and let V8 compile the code paths.
 */
export async function time(
  { runs, warmUp }: { runs: number; warmUp: number },
  run: (index: number) => Promise<unknown>,
): Promise<Timing> {
  for (let index = 0; index < warmUp; index += 1) {
    await run(index);
  }

  const durations: number[] = [];

  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    await run(index);
    durations.push(performance.now() - start);
  }

  durations.sort((a, b) => a - b);

  return { medianMs: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95) };
}

/** The plan PostgreSQL chose for `query`, with what one execution of it did and read. */
export async function explainAnalyze(pool: Pool, query: SentQuery): Promise<string> {
  // One text column per plan line; as arrays, its name ("QUERY PLAN") does not matter.
  const { rows } = await pool.query<[string]>({
    text: `explain (analyze, buffers) ${query.sql}`,
    values: query.params,
    rowMode: 'array',
  });

  return rows.map(([line]) => line).join('\n');
}
