import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const node = { console: 'readonly', process: 'readonly', URL: 'readonly' };
const browser = {
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  setTimeout: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  window: 'readonly',
};

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', 'blob-report/', '_site/'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './test/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.js'], languageOptions: { globals: node } },
  { files: ['docs/**/*.js'], languageOptions: { globals: browser } },
);
