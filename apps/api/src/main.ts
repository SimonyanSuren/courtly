import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Express names itself in every response by default; clients don't need to know.
  app.disable('x-powered-by');
  // SIGTERM/SIGINT: stop accepting connections and let in-flight requests finish.
  app.enableShutdownHooks();
  // <Env, true>: get() returns the validated, typed value, never undefined.
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
