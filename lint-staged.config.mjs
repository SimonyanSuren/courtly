/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,js,mjs}': ['eslint --fix'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
