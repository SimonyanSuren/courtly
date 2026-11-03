import { describe, expect, it } from '@jest/globals';

import { readCookie } from './cookies';

describe('readCookie', () => {
  it('finds a cookie among others, ignoring spaces around names and values', () => {
    expect(readCookie('theme=dark; session=abc123 ;lang=pt', 'session')).toBe('abc123');
  });

  it('answers undefined when the header or the cookie is missing', () => {
    expect(readCookie(undefined, 'session')).toBeUndefined();
    expect(readCookie('theme=dark', 'session')).toBeUndefined();
    expect(readCookie('session', 'session')).toBeUndefined();
  });

  it('keeps everything after the first "=" as the value', () => {
    expect(readCookie('session=a=b', 'session')).toBe('a=b');
  });

  it('takes the first of two cookies with the same name', () => {
    expect(readCookie('session=first; session=second', 'session')).toBe('first');
  });

  it('does not match a name that differs only by other whitespace', () => {
    expect(readCookie('\u{A0}__Host-session=forged', '__Host-session')).toBeUndefined();
  });
});
