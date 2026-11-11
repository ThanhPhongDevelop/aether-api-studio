/**
 * Prisma CLI configuration (Prisma ORM 7).
 *
 * The schema, migrations and seed live in the top-level `database/` folder so the
 * data layer is versioned independently from the API code. Relative paths below
 * are resolved from this file's directory (backend/).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'prisma/config';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));

// Prisma 7 no longer auto-loads .env files. Load backend/.env without overriding
// variables that are already set (so tests can point DATABASE_URL elsewhere).
const envFile = path.join(backendRoot, '.env');
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    process.env[key] ??= value;
  }
}

/** Resolve a relative SQLite URL against backend/ so CLI and runtime use the same file. */
function resolveSqliteUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const target = url.slice('file:'.length);
  if (target === ':memory:' || path.isAbsolute(target)) return url;
  return `file:${path.resolve(backendRoot, target)}`;
}

export default defineConfig({
  schema: '../database/schema/schema.prisma',
  migrations: {
    path: '../database/migrations',
    seed: 'tsx ../database/seed/seed.ts',
  },
  datasource: {
    url: resolveSqliteUrl(process.env.DATABASE_URL ?? 'file:./data/aether.db'),
  },
});
