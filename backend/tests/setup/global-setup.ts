import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = path.resolve(backendRoot, '../database/migrations');
const testDbFile = path.join(backendRoot, 'data', 'test.db');

/**
 * Rebuild the test database from the committed migration files before the run.
 * Applying the SQL directly keeps the suite fast and offline-friendly while
 * guaranteeing the exact schema that `prisma migrate deploy` produces.
 */
export default function setup(): void {
  mkdirSync(path.dirname(testDbFile), { recursive: true });
  for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`${testDbFile}${suffix}`, { force: true });

  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const db = new Database(testDbFile);
  try {
    for (const name of migrations) {
      db.exec(readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf8'));
    }
  } finally {
    db.close();
  }
}
