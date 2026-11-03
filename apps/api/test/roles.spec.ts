import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import request, { type Response } from 'supertest';

import { Roles } from '../src/modules/auth/decorators/roles.decorator';
import { users } from '../src/modules/users/users.schema';
import { DATABASE, type Database } from '../src/platform/database/database';
import { createTestApp } from './create-test-app';
import { resetDatabase } from './database';
import { createUser, logIn } from './users';

// Test-only routes, one for each kind of access a real route can have.
@Controller('probe/roles')
class RolesProbeController {
  @Roles(['admin'])
  @Get('admin')
  admin(): { route: string } {
    return { route: 'admin' };
  }

  @Roles(['user'])
  @Get('user')
  user(): { route: string } {
    return { route: 'user' };
  }

  @Roles(['user', 'admin'])
  @Get('both')
  both(): { route: string } {
    return { route: 'both' };
  }

  // Neither @Public() nor @Roles(): nobody decided who may use it.
  @Get('undecided')
  undecided(): { route: string } {
    return { route: 'undecided' };
  }
}

@Roles(['admin'])
@Controller('probe/admin-area')
class AdminAreaProbeController {
  @Get()
  index(): { route: string } {
    return { route: 'admin area' };
  }

  @Roles(['user'])
  @Get('for-users')
  forUsers(): { route: string } {
    return { route: 'for users' };
  }
}

describe('roles over HTTP', () => {
  let app: NestExpressApplication;
  let db: Database;
  let userCookie: string;
  let adminCookie: string;

  const get = async (path: string, cookie?: string): Promise<Response> => {
    const call = request(app.getHttpServer()).get(`/api/probe/${path}`);

    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  const statusOf = async (path: string, cookie: string): Promise<number> => {
    const response = await get(path, cookie);

    return response.status;
  };

  beforeAll(async () => {
    app = await createTestApp({ controllers: [RolesProbeController, AdminAreaProbeController] });
    db = app.get(DATABASE);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await createUser(db, { email: 'ana@example.com', role: 'user' });
    await createUser(db, { email: 'admin@example.com', role: 'admin' });
    userCookie = await logIn(app, 'ana@example.com');
    adminCookie = await logIn(app, 'admin@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('answer 401 without a session, before looking at roles', async () => {
    const response = await get('roles/admin');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('let only admins use an admin route', async () => {
    const asAdmin = await get('roles/admin', adminCookie);
    const asUser = await get('roles/admin', userCookie);

    expect(asAdmin.status).toBe(200);
    expect(asUser.status).toBe(403);
    expect(asUser.body).toEqual({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Your account does not have access to this.',
      code: 'FORBIDDEN',
    });
  });

  it('let only users use a user route, so an admin cannot act as a user', async () => {
    const asUser = await get('roles/user', userCookie);
    const asAdmin = await get('roles/user', adminCookie);

    expect(asUser.status).toBe(200);
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('let both roles use a route that names both', async () => {
    const asUser = await get('roles/both', userCookie);
    const asAdmin = await get('roles/both', adminCookie);

    expect(asUser.status).toBe(200);
    expect(asAdmin.status).toBe(200);
  });

  it('refuse a route that names no roles to everyone, with a 500', async () => {
    const asUser = await get('roles/undecided', userCookie);
    const asAdmin = await get('roles/undecided', adminCookie);

    expect(asUser.status).toBe(500);
    expect(asAdmin.status).toBe(500);
    expect(asAdmin.body).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it("apply a controller's roles to its routes, unless a route names its own", async () => {
    expect(await statusOf('admin-area', adminCookie)).toBe(200);
    expect(await statusOf('admin-area', userCookie)).toBe(403);
    expect(await statusOf('admin-area/for-users', userCookie)).toBe(200);
    expect(await statusOf('admin-area/for-users', adminCookie)).toBe(403);
  });

  it('apply a role change at the next request of the same session', async () => {
    expect(await statusOf('roles/admin', userCookie)).toBe(403);

    await db.update(users).set({ role: 'admin' }).where(eq(users.email, 'ana@example.com'));

    expect(await statusOf('roles/admin', userCookie)).toBe(200);
  });
});
