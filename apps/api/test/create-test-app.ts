import { type ModuleMetadata } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * Boots the real AppModule with the HTTP settings main.ts applies. `metadata` adds test-only
 * providers or controllers; `override` replaces providers, e.g. the database pool.
 */
export async function createTestApp(
  metadata: ModuleMetadata = {},
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<NestExpressApplication> {
  const moduleRef = await override(
    Test.createTestingModule({ ...metadata, imports: [AppModule, ...(metadata.imports ?? [])] }),
  ).compile();
  // logger: false keeps expected errors, such as a deliberate 500, out of the test output.
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();

  return app;
}
