import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv as parseDotenv } from 'node:util';
import { z } from 'zod';

/** Absolute path of the backend/ folder — valid from both src/ (tsx) and dist/ (node). */
export const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Load a .env file into `process.env` WITHOUT overriding variables that are
 * already defined, so real environment variables (CI, Docker, tests) always win.
 */
export function loadEnvFile(file = path.join(BACKEND_ROOT, '.env')): void {
  if (!existsSync(file)) return;
  const parsed = parseDotenv(readFileSync(file, 'utf8')) as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined && process.env[key] === undefined) process.env[key] = value;
  }
}

const PLACEHOLDER_SECRET = /replace-with|change-?me/i;
const DURATION = /^\d+[smhd]$/;

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().trim().min(1).optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    APP_NAME: z.string().trim().min(1).default('Aether API'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform(splitList)
      .pipe(z.array(z.url('every CORS origin must be a full URL, e.g. http://localhost:5173'))),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

    DATABASE_URL: z
      .string('DATABASE_URL is required')
      .trim()
      .startsWith('file:', 'DATABASE_URL must be a SQLite URL such as "file:./data/aether.db"'),

    JWT_ACCESS_SECRET: z.string('JWT_ACCESS_SECRET is required').min(32, 'must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string('JWT_REFRESH_SECRET is required').min(32, 'must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: z.string().regex(DURATION, 'use a duration like 15m, 1h or 7d').default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().regex(DURATION, 'use a duration like 15m, 1h or 7d').default('7d'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

    METRICS_ENABLED: z.stringbool().default(true),
    METRICS_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    /** Let the API Tester reach private/loopback addresses. Defaults to true outside production. */
    EXECUTOR_ALLOW_PRIVATE_NETWORKS: z.stringbool().optional(),
    /** Hosts the API Tester may always reach, even when private networks are blocked. */
    EXECUTOR_ALLOWED_HOSTS: z.string().default('').transform(splitList),
    EXECUTOR_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
    EXECUTOR_MAX_RESPONSE_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(50 * 1024 * 1024)
      .default(5 * 1024 * 1024),
    EXECUTOR_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),

    /** Base URL written into new accounts' "Local" environment (defaults to http://localhost:PORT/api). */
    PUBLIC_API_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.url('PUBLIC_API_URL must be a full URL, e.g. https://aether.example.com/api').optional(),
    ),

    /** Serve the built frontend (frontend/dist) from this server — single-origin production deploys. */
    SERVE_FRONTEND: z.stringbool().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'must be different from JWT_ACCESS_SECRET',
      });
    }
    if (value.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (PLACEHOLDER_SECRET.test(value[key])) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'placeholder secrets are not allowed in production' });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validate raw variables; throws a readable, actionable error when invalid. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment configuration:\n${details}\n\n` +
      'Hint: run "npm run setup" or copy backend/.env.example to backend/.env.',
  );
}

export function hasPlaceholderSecrets(config: Pick<Env, 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'>): boolean {
  return PLACEHOLDER_SECRET.test(config.JWT_ACCESS_SECRET) || PLACEHOLDER_SECRET.test(config.JWT_REFRESH_SECRET);
}

// Tests run with a hermetic environment defined in vitest.config.ts.
if (process.env.NODE_ENV !== 'test') loadEnvFile();

export const env = parseEnv(process.env);
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const executorAllowsPrivateNetworks = env.EXECUTOR_ALLOW_PRIVATE_NETWORKS ?? !isProduction;
