// Times and dates are the facility's, whatever time zone the visitor's device is in.
const timeZone = 'Europe/Lisbon';
// English with the day before the month and a 24-hour clock, as people in Portugal read them. A
// fixed locale also gives every visitor, and every test, the same text.
const locale = 'en-GB';

const dateFormat = new Intl.DateTimeFormat(locale, {
  timeZone,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat(locale, {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
});
const dayParts = new Intl.DateTimeFormat(locale, {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const euros = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });

/** The facility's calendar day of a moment from the API, such as "Thu, 5 Nov 2026". */
export function formatDate(moment: string): string {
  return dateFormat.format(new Date(moment));
}

/** The facility's clock time of a moment from the API, such as "18:00". */
export function formatTime(moment: string): string {
  return timeFormat.format(new Date(moment));
}

/** Two moments on the facility's clock, such as "18:00–20:00". */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

/** An opening or closing hour, such as "08:00"; 24 is the midnight that ends the day. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** A sport as a name, such as "Padel"; the API writes sports in lowercase. */
export function formatSport(sport: string): string {
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

/** Integer euro cents as euros, such as "€15.00". */
export function formatPrice(cents: number): string {
  return euros.format(cents / 100);
}

/** Today at the facility, written the way the API writes dates: "2026-11-05". */
export function today(): string {
  // Assembled from parts: a locale's own date order is display data that can change.
  const parts = dayParts.formatToParts(new Date());
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}
