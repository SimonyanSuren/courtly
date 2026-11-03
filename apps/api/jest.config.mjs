// ts-jest compiles each test with the TypeScript compiler and tsconfig.json, as the build does.
// It compiles file by file (isolatedModules), so `npm run typecheck` is what checks test types.
/** @type {import('jest').Config} */
export default {
  transform: { '^.+\\.ts$': 'ts-jest' },
  // One PostgreSQL container for the whole run (Testcontainers; Docker must be running), with a
  // migrated database for each worker.
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFiles: ['<rootDir>/test/use-worker-database.ts', '<rootDir>/test/login-limits.ts'],
};
