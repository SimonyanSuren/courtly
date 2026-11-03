import eslintJs from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import jsoncPlugin from 'eslint-plugin-jsonc';
import nPlugin from 'eslint-plugin-n';
import prettierPlugin from 'eslint-plugin-prettier';
import promisePlugin from 'eslint-plugin-promise';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import securityPlugin from 'eslint-plugin-security';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import unicornPlugin from 'eslint-plugin-unicorn';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  /* ─────────────────────────────── Global ignores ─────────────────────────────── */
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.d.ts',
      'backlog/**',
      // Agents' worktrees: other checkouts of this repository, each linted on its own.
      '.claude/worktrees/**',
    ],
  },

  /* ─────────────────────────────── Base JS recommended ─────────────────────────── */
  eslintJs.configs.recommended,

  /* ─────────────────────── TypeScript: every workspace ─────────────────────────── */
  {
    name: 'typescript',
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        // Each file is type-checked with the nearest tsconfig.json, so every workspace keeps
        // its own compiler settings.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
      'simple-import-sort': simpleImportSortPlugin,
      'unused-imports': unusedImportsPlugin,
      unicorn: unicornPlugin,
      sonarjs: sonarjsPlugin,
      promise: promisePlugin,
      security: securityPlugin,
    },
    settings: {
      // How import-x parses TypeScript files it follows. Without these, rules that walk the
      // import graph (no-cycle) see no dependencies and silently pass.
      'import-x/extensions': importX.flatConfigs.typescript.settings['import-x/extensions'],
      'import-x/parsers': importX.flatConfigs.typescript.settings['import-x/parsers'],
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      /* ── Spread plugin recommended rules ── */
      ...importX.flatConfigs.recommended.rules,
      ...unicornPlugin.configs.recommended.rules,
      ...sonarjsPlugin.configs.recommended.rules,
      ...promisePlugin.configs['flat/recommended'].rules,
      ...securityPlugin.configs.recommended.rules,

      /* ── Security ── */
      'security/detect-object-injection': 'off',

      /* ── Unicorn ── */
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/single-line-block-comment-style': 'off',
      // Leading asterisks are the JSDoc style editors insert and TypeScript's doc tooling reads.
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-static-only-class': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/expiring-todo-comments': 'off',
      'unicorn/no-array-method-this-argument': 'off',
      'unicorn/switch-case-braces': 'off',
      'unicorn/no-empty-file': 'warn',
      'unicorn/import-style': ['error', { styles: { 'node:path': { named: true } } }],

      /* ── Import-x ── */
      'import-x/no-unresolved': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
      'import-x/consistent-type-specifier-style': ['error', 'prefer-inline'],
      'import-x/newline-after-import': 'error',

      /* ── Unused imports ── */
      'unused-imports/no-unused-imports': 'error',

      /* ── Simple import sort ── */
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      /* ── SonarJS ── */
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-commented-code': 'off',
      'sonarjs/todo-tag': 'warn',

      /* ── TypeScript (overrides for strict/stylistic base configs) ── */
      '@typescript-eslint/return-await': 'error',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-use-before-define': 'error',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            Object: { message: 'Avoid using the `Object` type. Did you mean `object`?' },
            Function: {
              message:
                'Avoid using the `Function` type. Prefer a specific function type, like `() => void`.',
            },
            Boolean: {
              message: 'Avoid using the `Boolean` type. Did you mean `boolean`?',
              fixWith: 'boolean',
            },
            Number: {
              message: 'Avoid using the `Number` type. Did you mean `number`?',
              fixWith: 'number',
            },
            Symbol: {
              message: 'Avoid using the `Symbol` type. Did you mean `symbol`?',
              fixWith: 'symbol',
            },
            String: {
              message: 'Avoid using the `String` type. Did you mean `string`?',
              fixWith: 'string',
            },
            '{}': {
              message: 'Use Record<string, unknown> instead.',
              fixWith: 'Record<string, unknown>',
            },
            object: {
              message: 'Avoid using the `object` type. Did you mean `Record<string, unknown>`?',
              fixWith: 'Record<string, unknown>',
            },
          },
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['strictCamelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          modifiers: ['exported'],
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'should', 'has', 'can', 'did', 'will'],
        },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'property', format: ['camelCase', 'UPPER_CASE'] },
        // Keys that need quotes are names from outside, such as HTTP headers and URL paths.
        {
          selector: ['objectLiteralProperty', 'objectLiteralMethod'],
          modifiers: ['requiresQuotes'],
          format: null,
        },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
        },
        {
          selector: 'classProperty',
          modifiers: ['private'],
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],

      /* ── TypeScript-aware replacements for base ESLint rules ── */
      'dot-notation': 'off',
      '@typescript-eslint/dot-notation': 'error',
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': 'error',
      // TypeScript reports a real redeclaration itself (TS2451). A value and a type may share a
      // name, as the enum-like Role does: the object and the union of its values.
      'no-redeclare': 'off',
      'no-return-await': 'off',
      'no-shadow': 'off',
      'no-invalid-this': 'off',

      /* ── ESLint core rules ── */
      'max-params': ['error', 6],
      'no-await-in-loop': 'off',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'try' },
        { blankLine: 'always', prev: 'try', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'throw' },
        { blankLine: 'always', prev: 'var', next: '*' },
      ],
      'arrow-body-style': 'error',
      complexity: 'off',
      'no-useless-return': 'error',
      'no-else-return': 'error',
      'no-implicit-coercion': ['error', { allow: ['!!', '~'] }],
      curly: 'off',
      eqeqeq: ['error', 'smart'],
      'guard-for-in': 'error',
      'max-classes-per-file': 'off',
      'no-bitwise': 'error',
      'no-caller': 'error',
      'no-console': [
        'error',
        {
          allow: [
            'info',
            'warn',
            'error',
            'dir',
            'table',
            'group',
            'groupCollapsed',
            'groupEnd',
            'time',
            'timeEnd',
            'timeLog',
            'assert',
            'clear',
            'count',
            'countReset',
          ],
        },
      ],
      'no-eval': 'error',
      'no-extra-bind': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-sequences': 'error',
      'no-template-curly-in-string': 'error',
      'no-undef': 'off',
      'no-undef-init': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'prefer-object-spread': 'error',
      radix: 'error',
      yoda: 'error',
      strict: ['error', 'never'],
      'no-useless-rename': 'error',
    },
  },

  /* ─────────────────────── API: Node.js runtime rules ──────────────────────────── */
  {
    name: 'api-node',
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { n: nPlugin },
    rules: {
      ...nPlugin.configs['flat/recommended-module'].rules,
      // import-x resolves imports through TypeScript; n's own resolver does not.
      'n/no-extraneous-import': 'off',
      'n/no-missing-import': 'off',

      // Production code may only import runtime dependencies. devDependencies are missing from
      // the image (npm ci --omit=dev), so such an import compiles and passes tests, then crashes.
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: ['**/*.spec.ts', '**/test/**', '**/*.config.ts'],
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
    },
  },
  {
    // Technical code serves business modules and never depends on them (DECISIONS.md, entry 8).
    files: ['apps/api/src/platform/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`(^|/)modules(/|$)`,
              message: 'platform/ must not import business modules; move shared code to platform/.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'api-tests',
    files: ['apps/api/**/*.spec.ts', 'apps/api/test/**/*.ts'],
    rules: {
      // Tests create users with made-up passwords and hashes; none of them is a credential.
      'sonarjs/no-hardcoded-passwords': 'off',
    },
  },

  /* ─────────────────────── Web: React rules ────────────────────────────────────── */
  {
    name: 'web-react',
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    extends: [reactHooksPlugin.configs.flat.recommended],
  },
  {
    // Fast refresh keeps a component's state across edits only in files that export nothing but
    // components. Tests are not refreshed.
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['**/*.spec.tsx'],
    extends: [reactRefresh.configs.vite()],
  },

  /* ─────────────────────── JavaScript: tool configs (*.js, *.mjs) ──────────────── */
  {
    name: 'javascript',
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },

  /* ─────────────────────── JSON/JSONC linting ─────────────────────────────────── */
  ...jsoncPlugin.configs['flat/recommended-with-jsonc'],
  {
    name: 'json-strict',
    files: ['**/*.json'],
    ignores: ['**/tsconfig.json', '**/tsconfig.*.json'],
    rules: {
      'jsonc/no-comments': 'error',
    },
  },

  /* ─────────────────────── Prettier (must be last) ────────────────────────────── */
  eslintConfigPrettier,
  {
    name: 'prettier',
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'error',
    },
  },
);
