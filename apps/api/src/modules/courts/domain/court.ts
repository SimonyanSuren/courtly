/** The sports a court can be for. */
export const Sport = {
  PADEL: 'padel',
  TENNIS: 'tennis',
  SQUASH: 'squash',
  BADMINTON: 'badminton',
  PICKLEBALL: 'pickleball',
} as const;

export const MAX_COURT_NAME_LENGTH = 100;

/**
 * €1,000.00 an hour: far above any real court's price, so a price typed with extra zeros is
 * refused. A 2-hour booking's price, 2 × this, also stays far below the 2,147,483,647 an integer
 * column holds.
 */
export const MAX_HOURLY_PRICE_CENTS = 100_000;
