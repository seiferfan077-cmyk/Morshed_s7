// Expo SDK 57 supports ESLint flat config: https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores([
    'dist/**',
    '.expo/**',
    'android/**',
    'ios/**',
    'web-build/**',
  ]),
  expoConfig,
  {
    rules: {
      // Fail on common correctness defects.
      'no-debugger': 'error',
      'no-unreachable': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // Backend has a separate package and lockfile; root npm ci does not install its dependencies.
    files: ['backend/**/*.{js,mjs,cjs}'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
]);
