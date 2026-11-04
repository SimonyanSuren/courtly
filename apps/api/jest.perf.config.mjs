// `npm run perf`: times the booking queries on a database filled with up to a million synthetic
// bookings (perf/). It takes minutes, so `npm test` leaves it out: Jest's default test match
// there finds *.spec.ts files, never *.perf.ts. It starts PostgreSQL and migrates it as the tests
// do, with one worker, whose database the run fills.
import tests from './jest.config.mjs';

/** @type {import('jest').Config} */
export default {
  ...tests,
  testMatch: ['<rootDir>/perf/**/*.perf.ts'],
  maxWorkers: 1,
  setupFiles: ['<rootDir>/test/use-worker-database.ts'],
  // Filling a million bookings alone takes a minute or more.
  testTimeout: 30 * 60_000,
};
