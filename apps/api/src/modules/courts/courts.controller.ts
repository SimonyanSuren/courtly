import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';

import { ApiRoute } from '../../platform/api-docs/api-route.decorator';
import { AuthError } from '../auth/auth.errors';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/domain/role';
import { type PublicUser } from '../users/users.schema';
import { CourtError } from './courts.errors';
import { CourtsService } from './courts.service';
import { type CourtResponse, courtSchema } from './dto/court.response';
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
  @ApiRoute({
    summary: 'List the courts (any role)',
    response: z.array(courtSchema),
    description: 'By name: the active courts for users, all of them for admins.',
  })
  @Get()
  async list(@CurrentUser() user: PublicUser): Promise<CourtResponse[]> {
    return this.courts.list(user.role);
  }

  @Roles([Role.USER, Role.ADMIN])
  @ApiRoute({
    summary: 'Get a court (any role)',
    response: courtSchema,
    description: 'The court; an inactive one for admins only.',
    errors: [CourtError.notFound()],
  })
  @Get(':id')
  async get(
    @Param('id', courtId) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourtResponse> {
    return this.courts.get(id, user.role);
  }

  @Roles([Role.ADMIN])
  @ApiRoute({
    summary: 'Create a court (admin)',
    status: HttpStatus.CREATED,
    response: courtSchema,
    description: 'The new court, active.',
    errors: [CourtError.closesBeforeOpening(), AuthError.forbidden(), CourtError.nameTaken()],
  })
  @Post()
  async create(@Body({ schema: newCourtSchema }) court: NewCourtDto): Promise<CourtResponse> {
    return this.courts.create(court);
  }

  @Roles([Role.ADMIN])
  @ApiRoute({
    summary: 'Change a court (admin)',
    response: courtSchema,
    description: 'The court after the change.',
    errors: [
      CourtError.closesBeforeOpening(),
      AuthError.forbidden(),
      CourtError.notFound(),
      CourtError.nameTaken(),
    ],
  })
  @Patch(':id')
  async update(
    @Param('id', courtId) id: string,
    @Body({ schema: courtChangesSchema }) changes: CourtChangesDto,
  ): Promise<CourtResponse> {
    return this.courts.update(id, changes);
  }
}
