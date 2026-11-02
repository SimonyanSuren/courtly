import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigModule } from '@nestjs/config';

import { envSchema } from './env';

describe('environment validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults PORT to 3000', () => {
    expect(envSchema.parse({}).PORT).toBe(3000);
  });

  it('reads PORT as a number', () => {
    expect(envSchema.parse({ PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['abc', '0', '65536', '80.5', ''])('rejects PORT=%j', (port) => {
    expect(envSchema.safeParse({ PORT: port }).success).toBe(false);
  });

  it('stops the start with an error that names the invalid variable', async () => {
    process.env.PORT = 'not-a-port';
    // AppModule's options; ignoreEnvFile keeps a developer's local .env out of the test.
    const configModule = ConfigModule.forRoot({ validationSchema: envSchema, ignoreEnvFile: true });
    await expect(configModule).rejects.toThrow(/PORT/);
  });
});
