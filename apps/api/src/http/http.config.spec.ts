import { afterEach, describe, expect, it } from '@jest/globals';

import { httpConfig } from './http.config';

describe('httpConfig', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  function withPort(port: string | undefined): void {
    process.env = { ...originalEnv, PORT: port };
  }

  it('defaults the port to 3000', () => {
    withPort(undefined);

    expect(httpConfig().port).toBe(3000);
  });

  it('reads PORT as a number', () => {
    withPort('8080');

    expect(httpConfig().port).toBe(8080);
  });

  it.each(['abc', '0', '65536', '80.5', ''])('rejects PORT=%j', (port) => {
    withPort(port);

    expect(() => httpConfig()).toThrow(/PORT/);
  });
});
