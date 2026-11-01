import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Express names itself in every response by default; clients don't need to know.
  app.disable('x-powered-by');
  // SIGTERM/SIGINT: stop accepting connections and let in-flight requests finish.
  app.enableShutdownHooks();
  await app.listen(3000);
}

void bootstrap();
