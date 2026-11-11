// One flat config for the whole monorepo: `npm run lint` from the root.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules', '**/dist', '**/coverage', 'backend/src/generated', 'backend/data']),

  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'table'] }],
    },
  },

  {
    files: ['backend/**/*.ts', 'database/**/*.ts', 'scripts/**/*.mjs', '*.js', 'frontend/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    // The seed script and setup script report progress on the console by design.
    files: ['database/seed/**/*.ts', 'scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  {
    // Plain scripts served as-is (loaded before the app bundle).
    files: ['frontend/public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
]);
