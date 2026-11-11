import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { TrafficStats } from '../models/system.model.js';
import { percentage, roundTo } from '../utils/format.js';

export type ApiLogEntry = Prisma.ApiLogCreateManyInput;

export interface MetricsRecorderOptions {
  /** Flush buffered entries at most this often. */
  flushIntervalMs: number;
  /** Flush immediately once this many entries are buffered. */
  maxBatchSize: number;
  /** Hard cap protecting memory if the database is unavailable for a while. */
  maxBufferSize: number;
}

const DEFAULT_OPTIONS: MetricsRecorderOptions = {
  flushIntervalMs: 2_000,
  maxBatchSize: 100,
  maxBufferSize: 5_000,
};

/**
 * Collects one `ApiLog` row per API request and writes them in batches, so
 * request latency is never affected by the metrics write itself.
 */
export class ApiMetricsRecorder {
  private readonly db: PrismaClient;
  private readonly options: MetricsRecorderOptions;
  private buffer: ApiLogEntry[] = [];
  private timer: NodeJS.Timeout | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(db: PrismaClient, options: Partial<MetricsRecorderOptions> = {}) {
    this.db = db;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get pendingCount(): number {
    return this.buffer.length;
  }

  record(entry: ApiLogEntry): void {
    if (this.buffer.length >= this.options.maxBufferSize) this.buffer.shift();
    this.buffer.push(entry);

    if (this.buffer.length >= this.options.maxBatchSize) void this.flush();
    else this.scheduleFlush();
  }

  /** Persist everything buffered so far. Calls are serialized, so it is safe to call concurrently. */
  flush(): Promise<void> {
    this.clearTimer();
    this.queue = this.queue.then(() => this.writeBuffered());
    return this.queue;
  }

  /** Delete log rows older than the retention window; returns the number of rows removed. */
  async prune(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const { count } = await this.db.apiLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return count;
  }

  async stop(): Promise<void> {
    await this.flush();
  }

  private async writeBuffered(): Promise<void> {
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.options.maxBatchSize);
      try {
        await this.db.apiLog.createMany({ data: batch });
      } catch (err) {
        logger.warn({ err, dropped: batch.length }, 'Could not persist API metrics batch');
      }
    }
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.options.flushIntervalMs);
    this.timer.unref();
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

/** Process-wide recorder (null when METRICS_ENABLED=false). */
export const apiMetricsRecorder: ApiMetricsRecorder | null = env.METRICS_ENABLED
  ? new ApiMetricsRecorder(prisma)
  : null;

/** Aggregate API traffic over the last `windowHours` hours. */
export async function getTrafficStats(windowHours = 24, db: PrismaClient = prisma): Promise<TrafficStats> {
  const since = new Date(Date.now() - windowHours * 3_600_000);
  const where = { createdAt: { gte: since } } satisfies Prisma.ApiLogWhereInput;

  const [totals, failedRequests, serverErrors, byStatus, byRoute] = await Promise.all([
    db.apiLog.aggregate({
      where,
      _count: { _all: true },
      _avg: { durationMs: true },
      _max: { durationMs: true, createdAt: true },
    }),
    db.apiLog.count({ where: { ...where, statusCode: { gte: 400 } } }),
    db.apiLog.count({ where: { ...where, statusCode: { gte: 500 } } }),
    db.apiLog.groupBy({
      by: ['statusCode'],
      where,
      _count: { _all: true },
      orderBy: { statusCode: 'asc' },
    }),
    db.apiLog.groupBy({
      by: ['method', 'route'],
      where: { ...where, route: { not: null } },
      _count: { _all: true },
      _avg: { durationMs: true },
      orderBy: { _count: { route: 'desc' } },
      take: 5,
    }),
  ]);

  const totalRequests = totals._count._all;
  return {
    windowHours,
    totalRequests,
    successfulRequests: totalRequests - failedRequests,
    failedRequests,
    serverErrors,
    successRate: percentage(totalRequests - failedRequests, totalRequests),
    averageResponseTimeMs: roundTo(totals._avg.durationMs ?? 0),
    maxResponseTimeMs: roundTo(totals._max.durationMs ?? 0),
    lastRequestAt: totals._max.createdAt?.toISOString() ?? null,
    statusCodes: byStatus.map((row) => ({ statusCode: row.statusCode, count: row._count._all })),
    topRoutes: byRoute.map((row) => ({
      method: row.method,
      route: row.route ?? 'unknown',
      count: row._count._all,
      averageResponseTimeMs: roundTo(row._avg.durationMs ?? 0),
    })),
  };
}
