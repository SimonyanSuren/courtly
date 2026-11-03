import { type NestExpressApplication } from '@nestjs/platform-express';

/** HTTP settings main.ts and the HTTP tests share, so the tests exercise the API as it ships. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Express names itself in every response by default; clients don't need to know.
  app.disable('x-powered-by');
  // The session cookie goes with every request the browser makes, even one another site starts.
  // This rejects state-changing requests (POST, PUT, PATCH, DELETE) from another origin with 403,
  // judged by the Sec-Fetch-Site header, or by Origin against Host for older browsers.
  app.enableCsrfProtection();
}
