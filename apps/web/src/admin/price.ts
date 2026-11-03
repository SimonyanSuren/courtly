// Whole euros, then 1 or 2 decimals after a dot or a comma. The comma is what a keyboard set to
// Portuguese types, and with at most 2 decimals it never reads as a thousands separator: "1,500"
// has 3 digits after it and is rejected, not read as 1.50 or 1500.
// The rule counts the optional group as a nested repetition, but a separator, never a digit,
// starts it, so no text matches two ways and the check takes linear time.
// eslint-disable-next-line security/detect-unsafe-regex
const euros = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * A price typed in euros, such as "15", "15.1", "15.10" or "15,10", in integer cents; undefined
 * when the text is not such a price. A sign or a third decimal is refused rather than corrected,
 * since money changed silently is worse than a question. The digits are combined as integers:
 * as floating-point numbers, 19.99 × 100 is 1998.9999999999998.
 */
export function eurosToCents(text: string): number | undefined {
  const match = euros.exec(text.trim());

  if (!match) {
    return undefined;
  }

  const [, whole = '', decimals = ''] = match;

  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
}

/** Integer cents as the text eurosToCents reads, such as "15.10" for 1510. */
export function centsToEuros(cents: number): string {
  const digits = String(cents).padStart(3, '0');

  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
