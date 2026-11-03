const SPACE = 0x20;
const TAB = 0x09;

/**
 * Removes only spaces and tabs, the whitespace browsers strip. `String.prototype.trim()` would also
 * remove characters such as U+00A0: a cookie whose name is U+00A0 followed by `__Host-session`,
 * which browsers do not protect as a `__Host-` cookie, would then be read as the real one.
 */
function trimSpaces(text: string): string {
  const isSpace = (index: number): boolean => [SPACE, TAB].includes(text.codePointAt(index) ?? -1);
  let start = 0;
  let end = text.length;

  while (start < end && isSpace(start)) {
    start += 1;
  }

  while (end > start && isSpace(end - 1)) {
    end -= 1;
  }

  return text.slice(start, end);
}

/**
 * Reads one cookie from a request's `Cookie` header, or undefined when it was not sent. Nest's
 * `@Cookies()` decorator covers route handlers only; guards read the header with this.
 *
 * As in RFC 6265: pairs are separated by `;`, only spaces and tabs around a name or value are
 * removed, and the first pair with the name wins (browsers send the most specific path first).
 * Values are not percent-decoded: the cookies this API sets contain no characters that need it.
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
  const pairs = header?.split(';') ?? [];

  for (const pair of pairs) {
    const separator = pair.indexOf('=');

    if (separator !== -1 && trimSpaces(pair.slice(0, separator)) === name) {
      return trimSpaces(pair.slice(separator + 1));
    }
  }

  return undefined;
}
