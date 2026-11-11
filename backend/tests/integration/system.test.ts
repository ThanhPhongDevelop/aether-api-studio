import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { apiMetricsRecorder } from '../../src/services/metrics.service.js';
import { createProduct, createUser, resetDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(async () => {
  await resetDatabase();
  const admin = await createUser({ role: 'ADMIN' });
  await createUser();
  await Promise.all([1, 2, 3].map(() => createProduct({ createdById: admin.id })));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api', () => {
  it('returns the API index in the standard envelope', async () => {
    const res = await request(app).get('/api').expect('Content-Type', /json/).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: expect.any(String), version: '0.1.0', environment: 'test' });
    expect(res.body.data.endpoints).toContainEqual(expect.objectContaining({ path: '/api/health' }));
  });

  it('answers on the server root with pointers to the API', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.body.data.api).toBe('/api');
  });
});

describe('GET /api/health', () => {
  it('reports ok after a real database round-trip', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toMatchObject({
      status: 'ok',
      uptimeSeconds: expect.any(Number),
      checks: { database: { status: 'up', latencyMs: expect.any(Number) } },
    });
  });

  it('answers 503 SERVICE_UNAVAILABLE when the database is unreachable', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('SQLITE_CANTOPEN: unable to open database file'));

    const res = await request(app).get('/api/health').expect(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.details.checks.database).toMatchObject({
      status: 'down',
      error: expect.stringContaining('SQLITE_CANTOPEN'),
    });
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });
});

describe('GET /api/status', () => {
  beforeEach(async () => {
    await apiMetricsRecorder?.flush();
    await prisma.apiLog.deleteMany();
  });

  it('reports runtime details and live record counts', async () => {
    const res = await request(app).get('/api/status').expect(200);
    const { data } = res.body;

    expect(data.status).toBe('ok');
    expect(data.service).toMatchObject({ version: '0.1.0', environment: 'test' });
    expect(data.runtime.node).toBe(process.version);
    expect(data.runtime.memory.heapUsedBytes).toBeGreaterThan(0);
    expect(data.database).toMatchObject({ provider: 'sqlite', status: 'up' });
    expect(data.database.records).toMatchObject({ users: 2, products: 3, collections: 0 });
  });

  it('aggregates real API traffic recorded by the metrics middleware', async () => {
    await request(app).get('/api').expect(200);
    await request(app).get('/api/status').expect(200);
    await request(app).get('/api/does-not-exist').expect(404);
    await request(app).get('/api/health').expect(200); // probes are excluded from metrics
    await apiMetricsRecorder?.flush();

    const res = await request(app).get('/api/status').expect(200);
    const { traffic } = res.body.data;

    expect(traffic).toMatchObject({
      windowHours: 24,
      totalRequests: 3,
      successfulRequests: 2,
      failedRequests: 1,
      serverErrors: 0,
      successRate: 66.7,
    });
    expect(traffic.averageResponseTimeMs).toBeGreaterThan(0);
    expect(traffic.statusCodes).toEqual([
      { statusCode: 200, count: 2 },
      { statusCode: 404, count: 1 },
    ]);
    expect(traffic.topRoutes.map((route: { route: string }) => route.route).sort()).toEqual(['/api', '/api/status']);
  });

  it('stores one log row per request with the matched route pattern', async () => {
    await request(app).get('/api/status?verbose=1').expect(200);
    await request(app).get('/api/nope').expect(404);
    await apiMetricsRecorder?.flush();

    const rows = await prisma.apiLog.findMany({ orderBy: { id: 'asc' } });
    expect(rows).toEqual([
      expect.objectContaining({ method: 'GET', path: '/api/status', route: '/api/status', statusCode: 200 }),
      expect.objectContaining({ method: 'GET', path: '/api/nope', route: null, statusCode: 404 }),
    ]);
  });
});
