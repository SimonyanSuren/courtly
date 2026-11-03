import { Injectable } from '@nestjs/common';

import { isCheckViolation, isUniqueViolation } from '../../platform/database/errors';
import { Role } from '../users/domain/role';
import { CourtError } from './courts.errors';
import { CourtsRepository } from './courts.repository';
import { type Court, COURT_NAME_UNIQUE, COURT_OPENING_HOURS_VALID } from './courts.schema';
import { isValidOpeningHours, type OpeningHours } from './domain/opening-hours';
import { type CourtChangesDto } from './dto/court-changes.dto';
import { type NewCourtDto } from './dto/new-court.dto';

/** Each hour is valid on its own by now; this checks that the court opens before it closes. */
function assertValidOpeningHours(hours: OpeningHours): void {
  if (!isValidOpeningHours(hours)) {
    throw CourtError.closesBeforeOpening();
  }
}

/**
 * Waits for a write and answers in the API's terms when the table refuses it: COURT_NAME_TAKEN
 * when another court has the name, and the 400 of a court that would close before it opens. The
 * constraints decide, not the earlier checks: two requests for one name cannot both succeed, and
 * two changes of one court's hours, each valid against the hours it read, cannot combine into
 * hours that are not.
 */
async function refusingInvalidCourts<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error) {
    if (isUniqueViolation(error, COURT_NAME_UNIQUE)) {
      throw CourtError.nameTaken();
    }

    if (isCheckViolation(error, COURT_OPENING_HOURS_VALID)) {
      throw CourtError.closesBeforeOpening();
    }

    throw error;
  }
}

@Injectable()
export class CourtsService {
  constructor(private readonly courts: CourtsRepository) {}

  /** Admins see every court; users only the active ones, the ones they can book. */
  async list(role: Role): Promise<Court[]> {
    return this.courts.list({ activeOnly: role !== Role.ADMIN });
  }

  /** To a user, an inactive court does not exist. */
  async get(id: string, role: Role): Promise<Court> {
    const court = await this.courts.findById(id);

    if (!court || (role !== Role.ADMIN && !court.active)) {
      throw CourtError.notFound();
    }

    return court;
  }

  async create(court: NewCourtDto): Promise<Court> {
    assertValidOpeningHours(court);

    return refusingInvalidCourts(this.courts.create(court));
  }

  async update(id: string, changes: CourtChangesDto): Promise<Court> {
    const court = await this.courts.findById(id);

    if (!court) {
      throw CourtError.notFound();
    }

    // The hours as they will be: a new closing hour must still come after the stored opening
    // hour. Two changes at once could each pass against the hours they read; the table's CHECK
    // constraint then refuses the second, with the same 400.
    assertValidOpeningHours({
      openingHour: changes.openingHour ?? court.openingHour,
      closingHour: changes.closingHour ?? court.closingHour,
    });

    // Drizzle refuses an update that sets nothing.
    if (Object.keys(changes).length === 0) {
      return court;
    }

    const updated = await refusingInvalidCourts(this.courts.update(id, changes));

    if (!updated) {
      throw CourtError.notFound();
    }

    return updated;
  }
}
