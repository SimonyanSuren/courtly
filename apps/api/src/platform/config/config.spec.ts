import { afterEach, describe, expect, it } from '@jest/globals';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { z } from 'zod';

import { defineConfig } from './config';

const exampleConfig = defineConfig(
  'example',
  z.object({ EXAMPLE_LIMIT: z.coerce.number().int().min(1) }),
  (env) => ({ limit: env.EXAMPLE_LIMIT }),
);

describe('defineConfig', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('builds the typed value from validated variables', () => {
    process.env = { ...originalEnv, EXAMPLE_LIMIT: '25' };

    expect(exampleConfig()).toEqual({ limit: 25 });
  });

  it('fails with an error that names the namespace and the variable', () => {
    process.env = { ...originalEnv, EXAMPLE_LIMIT: 'many' };

    expect(() => exampleConfig()).toThrow(/Invalid example configuration[\s\S]*EXAMPLE_LIMIT/);
  });

  it('stops the start of an app that loads an invalid namespace', async () => {
    process.env = { ...originalEnv, EXAMPLE_LIMIT: '0' };
    // ignoreEnvFile keeps a developer's local .env out of the test.
    const moduleBuilder = Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [exampleConfig], ignoreEnvFile: true })],
    });

    await expect(moduleBuilder.compile()).rejects.toThrow(/EXAMPLE_LIMIT/);
  });
});
