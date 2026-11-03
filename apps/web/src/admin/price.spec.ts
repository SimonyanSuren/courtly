import { describe, expect, it } from 'vitest';

import { centsToEuros, eurosToCents } from './price';

describe('a price typed in euros', () => {
  it('becomes integer cents, without floating-point errors', () => {
    expect(eurosToCents('15')).toBe(1500);
    expect(eurosToCents('15.1')).toBe(1510);
    expect(eurosToCents('15.10')).toBe(1510);
    expect(eurosToCents('0.05')).toBe(5);
    // Both are a cent short when multiplied by 100 as floating-point numbers and truncated.
    expect(eurosToCents('19.99')).toBe(1999);
    expect(eurosToCents('0.29')).toBe(29);
  });

  it('may use a comma for the decimals and have spaces around it', () => {
    expect(eurosToCents('15,10')).toBe(1510);
    expect(eurosToCents(' 15.10 ')).toBe(1510);
  });

  it('leaves the range to the server: zero parses', () => {
    expect(eurosToCents('0')).toBe(0);
  });

  it.each([
    '',
    ' ',
    '-15',
    '+15',
    '15.105',
    '1,500',
    '1,234.56',
    '15.',
    '.5',
    '1e3',
    '15 €',
    'abc',
  ])('is refused when it reads %j', (text) => {
    expect(eurosToCents(text)).toBeUndefined();
  });

  it('is written back the way it is read', () => {
    expect(centsToEuros(1510)).toBe('15.10');
    expect(centsToEuros(1500)).toBe('15.00');
    expect(centsToEuros(5)).toBe('0.05');
    expect(centsToEuros(123_456)).toBe('1234.56');

    // Every price up to €1,000.00 survives the round trip.
    const prices = Array.from({ length: 100_001 }, (_, cents) => cents);
    expect(prices.filter((cents) => eurosToCents(centsToEuros(cents)) !== cents)).toEqual([]);
  });
});
