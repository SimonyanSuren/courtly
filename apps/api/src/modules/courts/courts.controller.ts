import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/domain/role';
import { type PublicUser } from '../users/users.schema';
import { CourtError } from './courts.errors';
import { type Court } from './courts.schema';
import { CourtsService } from './courts.service';
import { type CourtChangesDto, courtChangesSchema } from './dto/court-changes.dto';
import { type NewCourtDto, newCourtSchema } from './dto/new-court.dto';

// An id that is not a UUID names no court, so it gets the same 404 as an unknown one; PostgreSQL
// would otherwise reject it as uuid input, a 500.
const courtId = new ParseUUIDPipe({ exceptionFactory: CourtError.notFound });

/** Courts are never deleted, so there is no DELETE route: `{ "active": false }` retires one. */
@Controller('courts')
export class CourtsController {
  constructor(private readonly courts: CourtsService) {}

  @Roles([Role.USER, Role.ADMIN])
  @Get()
  async list(@CurrentUser() user: PublicUser): Promise<Court[]> {
    return this.courts.list(user.role);
  }

  @Roles([Role.USER, Role.ADMIN])
  @Get(':id')
  async get(@Param('id', courtId) id: string, @CurrentUser() user: PublicUser): Promise<Court> {
    return this.courts.get(id, user.role);
  }

  @Roles([Role.ADMIN])
  @Post()
  async create(@Body({ schema: newCourtSchema }) court: NewCourtDto): Promise<Court> {
    return this.courts.create(court);
  }

  @Roles([Role.ADMIN])
  @Patch(':id')
  async update(
    @Param('id', courtId) id: string,
    @Body({ schema: courtChangesSchema }) changes: CourtChangesDto,
  ): Promise<Court> {
    return this.courts.update(id, changes);
  }
}
