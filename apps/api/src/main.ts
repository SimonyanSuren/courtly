import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { type HttpConfig, httpConfig } from './platform/http/http.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // SIGTERM/SIGINT: stop accepting connections and let in-flight requests finish.
  app.enableShutdownHooks();
  const http = app.get<HttpConfig>(httpConfig.KEY);
  await app.listen(http.port);
}

void bootstrap();
