import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { createTestApp } from './create-test-app';

/** The parts of the OpenAPI document these tests read. */
interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  properties?: Record<string, Schema>;
  required?: string[];
}

interface Operation {
  summary?: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: { content: Record<string, { schema: Schema }> };
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>;
}

interface OpenApiDocument {
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, Schema>;
    securitySchemes: Record<string, { type: string; in: string; name: string }>;
  };
}

/** The parts of the Express app that tell which routes it answers: its router's routes. */
interface ExpressApp {
  router: { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> };
}

interface DocumentedRoute {
  /** As "GET /api/courts/{id}": OpenAPI writes :id as {id}. */
  name: string;
  method: string;
  path: string;
  operation: Operation;
}

const byName = (a: string, b: string): number => a.localeCompare(b);

/**
 * Every route the app answers, named as documentedRoutes() names them. Read from Express, where
 * Nest registered each with its full path, so a route added to any controller is listed here
 * without anyone listing it.
 */
function answeredRoutes(app: NestExpressApplication): string[] {
  // Express's types are not installed: the API never uses Express directly.
  const express = app.getHttpAdapter().getInstance() as ExpressApp;

  return (
    express.router.stack
      .flatMap(({ route }) =>
        route === undefined
          ? []
          : Object.keys(route.methods).map(
              (method) => `${method.toUpperCase()} ${route.path.replaceAll(/:(\w+)/g, '{$1}')}`,
            ),
      )
      // The reference's own routes, which it does not describe.
      .filter((name) => !name.includes(' /api/docs'))
  );
}

function documentedRoutes(document: OpenApiDocument): DocumentedRoute[] {
  return Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, operation]) => ({
      name: `${method.toUpperCase()} ${path}`,
      method,
      path,
      operation,
    })),
  );
}

describe('the API reference', () => {
  let app: NestExpressApplication;
  let document: OpenApiDocument;

  beforeAll(async () => {
    app = await createTestApp();
    // No session: the reference is public.
    const response = await request(app.getHttpServer()).get('/api/docs/openapi.json').expect(200);
    document = response.body as OpenApiDocument;
  });

  afterAll(async () => {
    await app.close();
  });

  it('describes exactly the routes the API answers', () => {
    const documented = documentedRoutes(document).map(({ name }) => name);

    expect(documented.toSorted(byName)).toEqual(answeredRoutes(app).toSorted(byName));
  });

  it('gives every route a summary and its success response', () => {
    // Nest also lists a route that has no documentation: with no summary and an empty 200.
    for (const { name, operation } of documentedRoutes(document)) {
      const success = Object.entries(operation.responses).filter(([status]) =>
        status.startsWith('2'),
      );

      expect({ name, summary: operation.summary }).toEqual({ name, summary: expect.any(String) });
      expect({ name, statuses: success.map(([status]) => status) }).toEqual({
        name,
        statuses: [expect.any(String)],
      });

      for (const [status, response] of success) {
        const isDescribed = status === '204' || response.content !== undefined;

        expect({ name, isDescribed }).toEqual({ name, isDescribed: true });
      }
    }
  });

  it('serves Swagger UI and its files without a session', async () => {
    const page = await request(app.getHttpServer()).get('/api/docs').expect(200);
    expect(page.headers['content-type']).toMatch(/^text\/html/);
    expect(page.text).toContain('swagger-ui-init.js');

    await request(app.getHttpServer()).get('/api/docs/swagger-ui-bundle.js').expect(200);
    await request(app.getHttpServer()).get('/api/docs/swagger-ui-init.js').expect(200);
  });

  it('documents a booking request from its Zod schema, as the client sends it', () => {
    const booking = document.paths['/api/bookings']?.post;
    const body = booking?.requestBody?.content['application/json']?.schema;

    expect(body?.required).toEqual(['courtId', 'startsAt', 'hours']);
    // startsAt becomes a Temporal.Instant once parsed; the client sends a string.
    expect(body?.properties).toMatchObject({
      courtId: { type: 'string', format: 'uuid' },
      startsAt: { type: 'string', format: 'date-time' },
      hours: { enum: [1, 2] },
    });
  });

  it('documents the booking a 201 answers with, and its errors as Problem Details', () => {
    const booking = document.paths['/api/bookings']?.post;
    const fields = [
      'id',
      'court',
      'startsAt',
      'endsAt',
      'hours',
      'priceCents',
      'status',
      'cancellableUntil',
      'createdAt',
      'cancelledAt',
    ];

    expect(booking?.responses['201']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/Booking',
    });
    expect(Object.keys(document.components.schemas.Booking?.properties ?? {})).toEqual(fields);
    expect(document.components.schemas.Booking?.required).toEqual(fields);
    expect(booking?.responses['409']).toMatchObject({
      content: {
        'application/problem+json': {
          schema: { $ref: '#/components/schemas/ProblemDetails' },
          examples: { SLOT_TAKEN: { value: { status: 409, code: 'SLOT_TAKEN' } } },
        },
      },
    });
  });

  it('documents every error response as Problem Details', () => {
    // `default` stands for every status a route does not list.
    const errors = documentedRoutes(document).flatMap(({ operation }) =>
      Object.entries(operation.responses).filter(
        ([status]) => status === 'default' || Number(status) >= 400,
      ),
    );

    expect(errors.length).toBeGreaterThan(0);

    for (const [, response] of errors) {
      expect(Object.keys(response.content ?? {})).toEqual(['application/problem+json']);
    }

    expect(document.components.schemas.ProblemDetails?.required).toEqual([
      'type',
      'title',
      'status',
      'detail',
      'code',
    ]);
  });

  it('gives every route the 500 the API answers with for a fault, as any other error', () => {
    for (const { name, operation } of documentedRoutes(document)) {
      expect({ name, other: operation.responses.default }).toMatchObject({
        name,
        other: {
          content: {
            'application/problem+json': {
              examples: {
                INTERNAL_SERVER_ERROR: {
                  value: { status: 500, code: 'INTERNAL_SERVER_ERROR' },
                },
              },
            },
          },
        },
      });
    }
  });

  it('marks a route as needing the session cookie exactly when it answers 401 without one', async () => {
    // The tests run with Secure cookies, the default, so the cookie has its __Host- name.
    expect(Object.values(document.components.securitySchemes)).toEqual([
      { type: 'apiKey', in: 'cookie', name: '__Host-session', description: expect.any(String) },
    ]);

    for (const { name, method, path, operation } of documentedRoutes(document)) {
      // Any UUID will do for an id: the session is checked before the route looks anything up.
      const url = path.replaceAll(/\{\w+\}/g, '019a4b2c-0000-7000-8000-000000000000');
      const response = await request(app.getHttpServer())[method as 'get' | 'post' | 'patch'](url);
      const isProtected = operation.security !== undefined;

      expect({ name, isUnauthorized: response.status === 401 }).toEqual({
        name,
        isUnauthorized: isProtected,
      });
      // Login answers 401 too, for a wrong password.
      expect({ name, has401: '401' in operation.responses }).toEqual({
        name,
        has401: isProtected || name === 'POST /api/auth/login',
      });
    }
  });
});
