// ts-jest compiles each test with the TypeScript compiler and tsconfig.json, as the build does.
// It compiles file by file (isolatedModules), so `npm run typecheck` is what checks test types.
/** @type {import('jest').Config} */
export default {
  transform: { '^.+\\.ts$': 'ts-jest' },
};
