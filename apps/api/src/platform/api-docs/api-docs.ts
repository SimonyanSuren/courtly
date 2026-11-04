import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { problemDetailsSchema } from '../http/problem-details.filter';
import { PROBLEM_DETAILS } from './api-errors.decorator';
import { SESSION_SECURITY } from './api-session.decorator';

const DESCRIPTION = `Every route can be tried here with **Try it out**.

**Sessions:** most routes need one. Log in with \`POST /api/auth/login\`: the browser keeps the
session cookie, which scripts cannot read, and sends it with every later request, so nothing needs
to be entered under **Authorize**. Without a session the answer is 401 \`UNAUTHORIZED\`; with the
wrong role, 403 \`FORBIDDEN\`. State-changing requests from another origin also get 403.

**Errors** are Problem Details (RFC 9457) with a stable \`code\`. **Moments** are ISO 8601 strings
with the facility's offset from UTC (Europe/Lisbon); requests may use any offset or \`Z\`. A
**date** is a calendar day in Europe/Lisbon. **Money** is integer euro cents.`;

/**
 * Serves the API reference: Swagger UI at /api/docs and the OpenAPI document at
 * /api/docs/openapi.json, both public and always on, since they describe routes anyone can call
 * and hold no secret. Nest adds these routes to Express directly, not as controllers, so the
 * global guards never see them. The document is built from the controllers and their Zod schemas
 * when it is first asked for, so starting the API, and every HTTP test, does not pay for it.
 * Swagger UI's files are only read, as the read-only container requires.
 */
export function setUpApiDocs(app: INestApplication, sessionCookieName: string): void {
  const config = new DocumentBuilder()
    .setTitle('Courtly API')
    .setDescription(DESCRIPTION)
    // The API has no versions: it changes additively, with the web app it ships with.
    .setVersion('unversioned')
    .addCookieAuth(
      sessionCookieName,
      {
        type: 'apiKey',
        description: 'Set by `POST /api/auth/login`, httpOnly; the browser sends it itself.',
      },
      SESSION_SECURITY,
    )
    .build();
  const components = {
    ...config.components,
    schemas: {
      // Error responses refer to it (see ApiProblemResponse). Converted as Nest converts every
      // other schema: through the Standard JSON Schema interface Zod implements, for OpenAPI 3.0.
      [PROBLEM_DETAILS]: problemDetailsSchema['~standard'].jsonSchema.output({
        target: 'openapi-3.0',
      }),
    },
  };

  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, { ...config, components }),
    {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'docs/openapi.json',
      // JSON only: one format is enough, and nothing else is served.
      raw: ['json'],
      customSiteTitle: 'Courtly API',
    },
  );
}
