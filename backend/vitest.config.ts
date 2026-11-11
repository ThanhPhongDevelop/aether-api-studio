import { defineConfig } from 'vitest/config';

/**
 * Tests run against a dedicated SQLite file (backend/data/test.db) rebuilt from
 * the committed migrations before every run, with a hermetic environment —
 * your backend/.env is never read and your dev database is never touched.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    setupFiles: ['tests/setup/per-file.ts'],
    // All files share one SQLite database, so run them one after another.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./data/test.db',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
      BCRYPT_SALT_ROUNDS: '4',
      LOG_LEVEL: 'silent',
      CORS_ORIGINS: 'http://localhost:5173',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
      LOGIN_MAX_ATTEMPTS: '5',
      LOGIN_LOCK_MINUTES: '15',
      METRICS_ENABLED: 'true',
    },
  },
});
