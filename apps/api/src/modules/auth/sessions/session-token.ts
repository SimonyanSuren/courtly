import { createHash, randomBytes } from 'node:crypto';

/** 256 random bits: far beyond guessing, as OWASP asks of session identifiers (at least 64). */
const TOKEN_BYTES = 32;

/**
 * The token is random, so a fast hash is enough: there is nothing to brute-force. Hex is the usual
 * text form of a SHA-256 digest; the hash never leaves the server, so its length does not matter,
 * and PostgreSQL's `encode(sha256(...), 'hex')` gives the same text.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A new token for the cookie and the hash stored in its place. base64url keeps the token short
 * (43 characters) and made only of characters a cookie value allows.
 */
export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  return { token, tokenHash: hashSessionToken(token) };
}
