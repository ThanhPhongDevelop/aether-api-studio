import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { bearer } from '../helpers/auth.js';
import { createUser, resetDatabase } from '../helpers/db.js';

const app = createApp({ metricsRecorder: null });
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

let admin: Awaited<ReturnType<typeof createUser>>;
let member: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ role: 'ADMIN' });
  member = await createUser();
  await prisma.requestHistory.createMany({
    data: [
      {
        userId: member.id,
        method: 'GET',
        url: 'https://api.test/users?page=1',
        statusCode: 200,
        durationMs: 100,
        createdAt: hoursAgo(1),
      },
      {
        userId: member.id,
        method: 'GET',
        url: 'https://api.test/users',
        statusCode: 404,
        durationMs: 50,
        createdAt: hoursAgo(2),
      },
      {
        userId: member.id,
        method: 'POST',
        url: 'https://api.test/orders',
        statusCode: null,
        durationMs: 30,
        createdAt: hoursAgo(3),
      },
      {
        userId: member.id,
        method: 'GET',
        url: 'https://api.test/old',
        statusCode: 200,
        durationMs: 10,
        createdAt: hoursAgo(24 * 40),
      },
      {
        userId: admin.id,
        method: 'GET',
        url: 'https://api.test/admin',
        statusCode: 200,
        durationMs: 5,
        createdAt: hoursAgo(1),
      },
    ],
  });
});

describe('GET /api/dashboard/stats', () => {
  it('summarises your own tester activity', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats?range=24h&tzOffset=420')
      .set('Authorization', bearer(member))
      .expect(200);
    const stats = res.body.data;
    expect(stats.totals).toEqual({
      totalRequests: 3,
      successfulRequests: 1,
      failedRequests: 2,
      successRate: 33.3,
      averageResponseTimeMs: 60,
    });
    expect(stats.timeline).toHaveLength(25);
    expect(stats.timeline.reduce((sum: number, bucket: { total: number }) => sum + bucket.total, 0)).toBe(3);
    expect(stats.statusCodes).toEqual([
      { statusCode: '200', count: 1 },
      { statusCode: '404', count: 1 },
      { statusCode: 'ERR', count: 1 },
    ]);
    expect(stats.methods).toEqual([
      { method: 'GET', count: 2 },
      { method: 'POST', count: 1 },
    ]);
    expect(stats.topEndpoints[0]).toMatchObject({ method: 'GET', endpoint: 'api.test/users', count: 2, failed: 1 });
    expect(stats.recentActivity).toHaveLength(4);
  });

  it('uses daily buckets for longer ranges', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats?range=7d')
      .set('Authorization', bearer(member))
      .expect(200);
    expect(res.body.data.bucket).toBe('day');
    expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(7);
  });

  it('restricts server-wide statistics to admins', async () => {
    await prisma.apiLog.createMany({
      data: [
        { method: 'GET', path: '/api/products', route: '/api/products', statusCode: 200, durationMs: 4 },
        { method: 'GET', path: '/api/nope', route: null, statusCode: 404, durationMs: 1 },
      ],
    });
    const forbidden = await request(app)
      .get('/api/dashboard/stats?scope=server')
      .set('Authorization', bearer(member))
      .expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    const res = await request(app)
      .get('/api/dashboard/stats?scope=server')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(res.body.data.totals.totalRequests).toBe(2);
  });

  it('validates the query and requires a token', async () => {
    await request(app).get('/api/dashboard/stats?range=1y').set('Authorization', bearer(member)).expect(400);
    await request(app).get('/api/dashboard/stats').expect(401);
  });
});

describe('GET /api/docs', () => {
  it('serves an OpenAPI 3.1 document covering the API', async () => {
    const res = await request(app).get('/api/docs').expect(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.info.version).toBe('0.1.0');
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/auth/login', '/users/{id}', '/products/{id}', '/requests/execute', '/dashboard/stats']),
    );
    expect(res.body.paths['/products'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(res.body.paths['/products'].post['x-access']).toBe('admin');
  });
});

describe('serving the built frontend', () => {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'aether-dist-'));
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Aether</title><div id="root"></div>');
  writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log("app")');
  const site = createApp({ metricsRecorder: null, frontendDist: dist });

  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it('serves index.html for client-side routes and long-caches fingerprinted assets', async () => {
    const home = await request(site).get('/').expect(200);
    expect(home.text).toContain('<div id="root">');
    expect(home.headers['content-security-policy']).toContain("script-src 'self'");
    await request(site).get('/dashboard').expect(200).expect('Content-Type', /html/);
    const asset = await request(site).get('/assets/app-abc123.js').expect(200);
    expect(asset.headers['cache-control']).toContain('immutable');
  });

  it('keeps the API and its JSON 404s', async () => {
    await request(site).get('/api/health').expect(200).expect('Content-Type', /json/);
    const missing = await request(site).get('/api/does-not-exist').expect(404);
    expect(missing.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
