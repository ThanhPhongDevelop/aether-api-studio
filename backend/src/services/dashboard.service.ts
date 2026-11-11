import { prisma } from '../config/database.js';
import type { DashboardQuery } from '../models/workspace.model.js';
import { percentage, roundTo } from '../utils/format.js';

const RANGE_HOURS = { '24h': 24, '7d': 168, '30d': 720 } as const;
const ROW_LIMIT = 50_000;

interface Sample {
  method: string;
  statusCode: number | null;
  durationMs: number;
  createdAt: Date;
  endpoint: string;
}

const isSuccess = (statusCode: number | null) => statusCode !== null && statusCode >= 200 && statusCode < 400;

/** Bucket label in the viewer's local time: "2026-11-06T14:00" (hourly) or "2026-11-06" (daily). */
function bucketLabel(date: Date, tzOffset: number, unit: 'hour' | 'day') {
  const local = new Date(date.getTime() + tzOffset * 60_000).toISOString();
  return unit === 'hour' ? `${local.slice(0, 13)}:00` : local.slice(0, 10);
}

function endpointOf(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

async function loadSamples(scope: DashboardQuery['scope'], userId: number, since: Date) {
  if (scope === 'me') {
    const rows = await prisma.requestHistory.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { method: true, statusCode: true, durationMs: true, createdAt: true, url: true },
      orderBy: { createdAt: 'desc' },
      take: ROW_LIMIT,
    });
    return rows.map((row): Sample => ({ ...row, endpoint: endpointOf(row.url) }));
  }
  const rows = await prisma.apiLog.findMany({
    where: { createdAt: { gte: since } },
    select: { method: true, statusCode: true, durationMs: true, createdAt: true, route: true, path: true },
    orderBy: { createdAt: 'desc' },
    take: ROW_LIMIT,
  });
  return rows.map((row): Sample => ({ ...row, endpoint: row.route ?? row.path }));
}

async function loadRecent(scope: DashboardQuery['scope'], userId: number) {
  if (scope === 'me') {
    const rows = await prisma.requestHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 8 });
    return rows.map((row) => ({
      id: row.id,
      method: row.method,
      target: row.url,
      statusCode: row.statusCode,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
    }));
  }
  const rows = await prisma.apiLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 });
  return rows.map((row) => ({
    id: String(row.id),
    method: row.method,
    target: row.path,
    statusCode: row.statusCode,
    durationMs: roundTo(row.durationMs, 1),
    createdAt: row.createdAt,
  }));
}

export async function getDashboardStats(query: DashboardQuery, userId: number) {
  const hours = RANGE_HOURS[query.range];
  const unit = query.range === '24h' ? 'hour' : 'day';
  const now = new Date();
  const since = new Date(now.getTime() - hours * 3_600_000);

  const [samples, recent] = await Promise.all([
    loadSamples(query.scope, userId, since),
    loadRecent(query.scope, userId),
  ]);

  const successful = samples.filter((sample) => isSuccess(sample.statusCode)).length;
  const totalDuration = samples.reduce((sum, sample) => sum + sample.durationMs, 0);

  // Every bucket in the window is present (zero-filled) so charts have a continuous axis.
  const timeline = new Map<string, { total: number; successful: number; failed: number; duration: number }>();
  const step = unit === 'hour' ? 3_600_000 : 86_400_000;
  const emptyBucket = () => ({ total: 0, successful: 0, failed: 0, duration: 0 });
  for (let time = since.getTime(); time < now.getTime(); time += step) {
    timeline.set(bucketLabel(new Date(time), query.tzOffset, unit), emptyBucket());
  }
  const currentLabel = bucketLabel(now, query.tzOffset, unit);
  if (!timeline.has(currentLabel)) timeline.set(currentLabel, emptyBucket());

  const statusCodes = new Map<string, number>();
  const methods = new Map<string, number>();
  const endpoints = new Map<string, { count: number; duration: number; failed: number }>();

  for (const sample of samples) {
    const ok = isSuccess(sample.statusCode);
    const bucket = timeline.get(bucketLabel(sample.createdAt, query.tzOffset, unit));
    if (bucket) {
      bucket.total += 1;
      bucket.duration += sample.durationMs;
      if (ok) bucket.successful += 1;
      else bucket.failed += 1;
    }
    const code = sample.statusCode === null ? 'ERR' : String(sample.statusCode);
    statusCodes.set(code, (statusCodes.get(code) ?? 0) + 1);
    methods.set(sample.method, (methods.get(sample.method) ?? 0) + 1);
    const endpoint = endpoints.get(`${sample.method} ${sample.endpoint}`) ?? { count: 0, duration: 0, failed: 0 };
    endpoint.count += 1;
    endpoint.duration += sample.durationMs;
    if (!ok) endpoint.failed += 1;
    endpoints.set(`${sample.method} ${sample.endpoint}`, endpoint);
  }

  return {
    scope: query.scope,
    range: query.range,
    bucket: unit,
    generatedAt: now,
    sampled: samples.length >= ROW_LIMIT,
    totals: {
      totalRequests: samples.length,
      successfulRequests: successful,
      failedRequests: samples.length - successful,
      successRate: percentage(successful, samples.length),
      averageResponseTimeMs: samples.length ? roundTo(totalDuration / samples.length, 1) : 0,
    },
    timeline: [...timeline.entries()].map(([label, bucket]) => ({
      bucket: label,
      total: bucket.total,
      successful: bucket.successful,
      failed: bucket.failed,
      averageResponseTimeMs: bucket.total ? roundTo(bucket.duration / bucket.total, 1) : 0,
    })),
    statusCodes: [...statusCodes.entries()]
      .map(([statusCode, count]) => ({ statusCode, count }))
      .sort((a, b) => a.statusCode.localeCompare(b.statusCode)),
    methods: [...methods.entries()].map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count),
    topEndpoints: [...endpoints.entries()]
      .map(([key, value]) => {
        const [method, ...rest] = key.split(' ');
        return {
          method: method ?? 'GET',
          endpoint: rest.join(' '),
          count: value.count,
          failed: value.failed,
          averageResponseTimeMs: roundTo(value.duration / value.count, 1),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    recentActivity: recent,
  };
}
