import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../platform/database/database';
import { type Court, courts } from './courts.schema';

/** The columns of a Court, so every query returns what the API shows and nothing more. */
const courtColumns = {
  id: courts.id,
  name: courts.name,
  sport: courts.sport,
  hourlyPriceCents: courts.hourlyPriceCents,
  openingHour: courts.openingHour,
  closingHour: courts.closingHour,
  active: courts.active,
};

type NewCourt = Omit<Court, 'id' | 'active'>;

/** Drizzle leaves a field that is undefined out of the update, so it keeps its value. */
type CourtChanges = { [Field in Exclude<keyof Court, 'id'>]?: Court[Field] | undefined };

@Injectable()
export class CourtsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Every court, or only the active ones, ordered by name. */
  async list({ activeOnly }: { activeOnly: boolean }): Promise<Court[]> {
    return this.db
      .select(courtColumns)
      .from(courts)
      .where(activeOnly ? eq(courts.active, true) : undefined)
      .orderBy(asc(courts.name));
  }

  async findById(id: string): Promise<Court | undefined> {
    const [court] = await this.db.select(courtColumns).from(courts).where(eq(courts.id, id));

    return court;
  }

  /** Inserts an active court. A name another court has breaks COURT_NAME_UNIQUE. */
  async create(court: NewCourt): Promise<Court> {
    const [created] = await this.db.insert(courts).values(court).returning(courtColumns);

    if (!created) {
      throw new Error('The insert returned no court.');
    }

    return created;
  }

  /** Applies the changes; undefined when no court has this id. Expects at least one change. */
  async update(id: string, changes: CourtChanges): Promise<Court | undefined> {
    const [updated] = await this.db
      .update(courts)
      .set(changes)
      .where(eq(courts.id, id))
      .returning(courtColumns);

    return updated;
  }
}
