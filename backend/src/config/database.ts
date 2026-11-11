import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';
import { BACKEND_ROOT, env, isDevelopment } from './env.js';

/**
 * Resolve a relative SQLite URL (`file:./data/aether.db`) against backend/ so the
 * Prisma CLI (see prisma.config.ts) and the running server always open the same file,
 * regardless of the current working directory.
 */
export function resolveSqliteUrl(url: string, baseDir: string = BACKEND_ROOT): string {
  if (!url.startsWith('file:')) return url;
  const target = url.slice('file:'.length);
  if (target === ':memory:' || path.isAbsolute(target)) return url;
  return `file:${path.resolve(baseDir, target)}`;
}

export function createPrismaClient(databaseUrl: string = env.DATABASE_URL): PrismaClient {
  const url = resolveSqliteUrl(databaseUrl);
  const file = url.slice('file:'.length);
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });

  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter, log: isDevelopment ? ['warn'] : [] });
}

/** Shared Prisma client for the whole process. */
export const prisma = createPrismaClient();
