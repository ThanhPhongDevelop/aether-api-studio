import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { apiMetrics } from '../../src/middleware/api-metrics.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import type { ApiLogEntry, ApiMetricsRecorder } from '../../src/services/metrics.service.js';
import { AppError } from '../../src/utils/app-error.js';
import { createRouter } from '../../src/utils/router.js';

const app = createApp({ metricsRecorder: null });
const ALLOWED_ORIGIN = 'http://localhost:5173';

describe('error handling', () => {
  it('returns 404 ROUTE_NOT_FOUND for unknown routes without echoing the query string', async () => {
    const res = await request(app).get('/api/does-not-exist?token=super-secret').expect(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Cannot GET /api/does-not-exist',
        requestId: res.headers['x-request-id'],
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('super-secret');
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken"')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 413 PAYLOAD_TOO_LARGE above the 1 MB body limit', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(1_100_000) }))
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const res = await request(app).get('/api').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('allows whitelisted origins with credentials', async () => {
    const res = await request(app).get('/api').set('Origin', ALLOWED_ORIGIN).expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });

  it('does not grant access to other origins', async () => {
    const res = await request(app).get('/api').set('Origin', 'https://evil.example').expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight requests', async () => {
    const res = await request(app)
      .options('/api/products')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type')
      .expect(204);
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });
});

describe('request id', () => {
  it('echoes a well-formed incoming X-Request-Id', async () => {
    const res = await request(app).get('/api').set('X-Request-Id', 'trace-abc.123').expect(200);
    expect(res.headers['x-request-id']).toBe('trace-abc.123');
  });

  it('replaces unsafe request ids with a fresh UUID', async () => {
    const res = await request(app).get('/api').set('X-Request-Id', 'bad id <script>').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('rate limiting', () => {
  it('returns 429 RATE_LIMITED with standard headers once the limit is exceeded', async () => {
    const limited = createApp({ rateLimit: { windowMs: 60_000, limit: 2 }, metricsRecorder: null });

    await request(limited).get('/api').expect(200);
    const second = await request(limited).get('/api').expect(200);
    expect(second.headers['ratelimit-policy']).toContain('q=2');

    const blocked = await request(limited).get('/api').expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.details).toEqual({ limit: 2, windowSeconds: 60 });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // Health probes are never rate limited.
    await request(limited).get('/api/health').expect(200);
  });
});

describe('metrics route patterns', () => {
  it('keeps the full mount path for requests that fail inside nested routers', async () => {
    const entries: ApiLogEntry[] = [];
    const recorder = { record: (entry: ApiLogEntry) => entries.push(entry) } as unknown as ApiMetricsRecorder;

    const items = createRouter();
    items.get('/:id', () => {
      throw AppError.notFound('Item');
    });
    const api = createRouter();
    api.use('/items', items);

    const mini = express();
    mini.use('/api', apiMetrics(recorder));
    mini.use('/api', api);
    mini.use(errorHandler);

    await request(mini).get('/api/items/42').expect(404);
    expect(entries).toEqual([
      expect.objectContaining({ path: '/api/items/42', route: '/api/items/:id', statusCode: 404 }),
    ]);
  });
});
