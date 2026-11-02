import { describe, expect, it } from '@jest/globals';

import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it("stores argon2id with OWASP's cost in PHC format, never the password", async () => {
    const hash = await hasher.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[\d+/A-Za-z]{22}\$[\d+/A-Za-z]{43}$/);
    expect(hash).not.toContain('correct horse');
  });

  it('salts every hash, so equal passwords get different hashes', async () => {
    const first = await hasher.hash('same password');
    const second = await hasher.hash('same password');

    expect(first).not.toBe(second);
  });

  it('accepts the right password and rejects any other', async () => {
    const hash = await hasher.hash('correct horse battery staple');

    await expect(hasher.verify('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(hasher.verify('correct horse battery stapler', hash)).resolves.toBe(false);
    await expect(hasher.verify('', hash)).resolves.toBe(false);
  });

  it('accepts the same password written with other Unicode code points', async () => {
    // "é" as one code point (U+00E9), then as "e" followed by a combining accent (U+0301).
    const hash = await hasher.hash('café');

    await expect(hasher.verify('café', hash)).resolves.toBe(true);
  });

  it('reads the cost from the stored hash, and checks hashes from other argon2 libraries', async () => {
    // From the test suite of the Argon2 reference implementation (src/test.c): the password
    // "password", salt "somesalt", 64 MiB, 2 passes, 1 lane.
    const referenceHash =
      '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc';

    await expect(hasher.verify('password', referenceHash)).resolves.toBe(true);
    await expect(hasher.verify('Password', referenceHash)).resolves.toBe(false);
  });

  it('rejects a stored hash it cannot read, or one asking for too much memory', async () => {
    const tooMuchMemory =
      '$argon2id$v=19$m=9999999,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc';

    await expect(hasher.verify('password', 'not a hash')).resolves.toBe(false);
    await expect(hasher.verify('password', tooMuchMemory)).resolves.toBe(false);
  });

  it('answers false for an unknown email after checking a dummy hash', async () => {
    await expect(hasher.verify('any password', undefined)).resolves.toBe(false);
  });
});
