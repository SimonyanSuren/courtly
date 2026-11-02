import { type NestExpressApplication } from '@nestjs/platform-express';

/** HTTP settings main.ts and the HTTP tests share, so the tests exercise the API as it ships. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Express names itself in every response by default; clients don't need to know.
  app.disable('x-powered-by');
}
