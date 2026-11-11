import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '../config/database.js';
import { BACKEND_ROOT, env, isProduction } from '../config/env.js';
import type {
  ApiIndex,
  DatabaseCheck,
  HealthReport,
  OverallStatus,
  RecordCounts,
  StatusReport,
  TrafficStats,
} from '../models/system.model.js';
import { roundTo } from '../utils/format.js';
import { getTrafficStats } from './metrics.service.js';

const SLOW_DATABASE_MS = 1_000;
const HIGH_SERVER_ERROR_RATE = 0.05;
const MIN_REQUESTS_FOR_ERROR_RATE = 20;

const pkg = JSON.parse(readFileSync(path.join(BACKEND_ROOT, 'package.json'), 'utf8')) as { version: string };
export const APP_VERSION = pkg.version;

const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';

export function getApiIndex(): ApiIndex {
  return {
    name: env.APP_NAME,
    version: APP_VERSION,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: [
      { method: 'GET', path: '/api/docs', description: 'OpenAPI 3.1 document describing every endpoint' },
      { method: 'GET', path: '/api/health', description: 'Liveness probe with a database connectivity check' },
      { method: 'GET', path: '/api/status', description: 'Runtime, database and API traffic statistics' },
      { method: 'POST', path: '/api/auth/login', description: 'Sign in and receive an access token' },
      { method: 'GET', path: '/api/products', description: 'Product catalogue with search, filters and sorting' },
      { method: 'GET', path: '/api/users', description: 'User management (admin)' },
      { method: 'POST', path: '/api/requests/execute', description: 'Send a request through the API Tester engine' },
    ],
  };
}

/** Round-trip a trivial query to prove the database is reachable. */
export async function checkDatabase(): Promise<DatabaseCheck> {
  const started = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up', latencyMs: roundTo(performance.now() - started) };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: roundTo(performance.now() - started),
      error: isProduction ? 'Database is unreachable' : firstLine(error),
    };
  }
}

export function deriveOverallStatus(database: DatabaseCheck, traffic: TrafficStats | null): OverallStatus {
  if (database.status === 'down') return 'down';
  if (database.latencyMs > SLOW_DATABASE_MS) return 'degraded';
  if (
    traffic &&
    traffic.totalRequests >= MIN_REQUESTS_FOR_ERROR_RATE &&
    traffic.serverErrors / traffic.totalRequests > HIGH_SERVER_ERROR_RATE
  ) {
    return 'degraded';
  }
  return 'ok';
}

export async function getHealthReport(): Promise<HealthReport> {
  const database = await checkDatabase();
  return {
    status: deriveOverallStatus(database, null),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database },
  };
}

async function countRecords(): Promise<RecordCounts> {
  const [users, products, collections, savedRequests, environments, requestHistory] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.collection.count(),
    prisma.savedRequest.count(),
    prisma.environment.count(),
    prisma.requestHistory.count(),
  ]);
  return { users, products, collections, savedRequests, environments, requestHistory };
}

export async function getStatusReport(): Promise<StatusReport> {
  const database = await checkDatabase();
  const isUp = database.status === 'up';

  const [records, traffic] = await Promise.all([
    isUp ? countRecords().catch(() => null) : null,
    isUp && env.METRICS_ENABLED ? getTrafficStats(24).catch(() => null) : null,
  ]);

  const memory = process.memoryUsage();
  return {
    status: deriveOverallStatus(database, traffic),
    timestamp: new Date().toISOString(),
    service: {
      name: env.APP_NAME,
      version: APP_VERSION,
      environment: env.NODE_ENV,
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.availableParallelism(),
      loadAverage: os.loadavg().map((value) => roundTo(value)),
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        systemTotalBytes: os.totalmem(),
        systemFreeBytes: os.freemem(),
      },
    },
    database: { provider: 'sqlite', ...database, records },
    metricsEnabled: env.METRICS_ENABLED,
    traffic,
  };
}
