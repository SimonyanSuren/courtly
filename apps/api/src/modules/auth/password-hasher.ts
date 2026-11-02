// eslint-plugin-n still lists argon2 as experimental: it was a release candidate in Node 24.7 and
// is stable since Node 26.4.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { Injectable } from '@nestjs/common';

const argon2Async = promisify(argon2);

interface Argon2Cost {
  /** Memory in KiB. */
  memory: number;
  passes: number;
  parallelism: number;
}

/** OWASP's recommended minimum for argon2id: 19 MiB of memory, 2 passes, 1 lane. */
const COST: Argon2Cost = { memory: 19_456, passes: 2, parallelism: 1 };
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/**
 * Most memory a stored hash may ask for (256 MiB). The cost is read back from the stored hash, so
 * an edited row could otherwise make a single login allocate any amount of memory.
 */
const MAX_MEMORY_KIB = 262_144;

/**
 * The PHC string format other argon2 libraries also read and write:
 * `$argon2id$v=19$m=<KiB>,t=<passes>,p=<lanes>$<salt>$<hash>`, in base64 without padding.
 * Version 19 (0x13) is the current version of Argon2, the one Node implements. The salt has at
 * least 8 bytes (11 characters), Node's minimum; the hash at least 16 bytes (22 characters).
 */
const STORED_HASH =
  /^\$argon2id\$v=19\$m=(\d{1,7}),t=(\d{1,2}),p=(\d{1,2})\$([\d+/A-Za-z]{11,})\$([\d+/A-Za-z]{22,})$/;

interface StoredHash {
  cost: Argon2Cost;
  salt: Buffer;
  hash: Buffer;
}

async function derive(
  password: string,
  salt: Buffer,
  cost: Argon2Cost,
  length: number,
): Promise<Buffer> {
  return argon2Async('argon2id', {
    // NFKC: the same password typed on another keyboard or system can arrive as different Unicode
    // code points (é as one character, or e plus an accent); normalising makes both verify.
    message: password.normalize('NFKC'),
    nonce: salt,
    memory: cost.memory,
    passes: cost.passes,
    parallelism: cost.parallelism,
    tagLength: length,
  });
}

function base64(bytes: Buffer): string {
  return bytes.toString('base64').replaceAll('=', '');
}

function format({ cost, salt, hash }: StoredHash): string {
  const parameters = `m=${String(cost.memory)},t=${String(cost.passes)},p=${String(cost.parallelism)}`;

  return `$argon2id$v=19$${parameters}$${base64(salt)}$${base64(hash)}`;
}

function parse(storedHash: string): StoredHash | undefined {
  const match = STORED_HASH.exec(storedHash);

  if (!match) {
    return undefined;
  }

  const cost = {
    memory: Number(match[1]),
    passes: Number(match[2]),
    parallelism: Number(match[3]),
  };

  // Every group of the pattern is required, so String() only tells TypeScript it is there.
  return cost.memory > MAX_MEMORY_KIB
    ? undefined
    : {
        cost,
        salt: Buffer.from(String(match[4]), 'base64'),
        hash: Buffer.from(String(match[5]), 'base64'),
      };
}

/**
 * Hashes and checks passwords with argon2id, built into Node: no native dependency to compile.
 * Each hash records its own cost, so the cost can be raised later without breaking stored hashes.
 */
@Injectable()
export class PasswordHasher {
  /**
   * Checked in place of a real hash when no account has the email. Made once, in the background,
   * when the hasher is created, so every later check costs exactly one derivation.
   */
  private readonly dummyHash = this.hash('dummy password, checked for unknown emails');

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const hash = await derive(password, salt, COST, HASH_BYTES);

    return format({ cost: COST, salt, hash });
  }

  /**
   * Checks a password against a stored hash, comparing in constant time. Pass `undefined` when no
   * account has the email: a dummy hash is checked instead, so the response time does not reveal
   * which emails are registered.
   */
  async verify(password: string, storedHash: string | undefined): Promise<boolean> {
    if (storedHash === undefined) {
      await this.verify(password, await this.dummyHash);

      return false;
    }

    const stored = parse(storedHash);

    if (!stored) {
      return false;
    }

    const hash = await derive(password, stored.salt, stored.cost, stored.hash.length);

    return timingSafeEqual(hash, stored.hash);
  }
}
