import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { isPrivateAddress, type ExecutorPolicy } from '../../src/services/executor.service.js';
import { bearer } from '../helpers/auth.js';
import { createUser, resetDatabase } from '../helpers/db.js';

interface Received {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const received: Received[] = [];
const target = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
    const url = new URL(req.url ?? '/', 'http://target');
    switch (url.pathname) {
      case '/json':
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Target': 'yes' });
        return res.end(JSON.stringify({ ok: true }));
      case '/echo':
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ method: req.method, query: Object.fromEntries(url.searchParams), body }));
      case '/redirect':
        res.writeHead(302, { Location: '/json' });
        return res.end();
      case '/redirect-internal':
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' });
        return res.end();
      case '/gzip':
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
        return res.end(zlib.gzipSync(JSON.stringify({ compressed: true })));
      case '/slow':
        return void setTimeout(() => res.writeHead(200).end('late'), 1500);
      case '/big':
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('x'.repeat(50_000));
      case '/binary':
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        return res.end(Buffer.from([0, 1, 2, 255]));
      default:
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('missing');
    }
  });
});

let base = '';
let closedPort = 0;
let auth = '';

const policy = (overrides: Partial<ExecutorPolicy> = {}): ExecutorPolicy => ({
  allowPrivateNetworks: true,
  allowedHosts: [],
  maxResponseBytes: 5 * 1024 * 1024,
  defaultTimeoutMs: 5_000,
  maxRedirects: 5,
  ...overrides,
});

const app = createApp({ metricsRecorder: null, executorPolicy: policy() });
const lockedDown = createApp({ metricsRecorder: null, executorPolicy: policy({ allowPrivateNetworks: false }) });

beforeAll(async () => {
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(target.address() as AddressInfo).port}`;
  const probe = http.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  closedPort = (probe.address() as AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});

afterAll(async () => {
  target.closeAllConnections();
  await new Promise<void>((resolve) => target.close(() => resolve()));
});

beforeEach(async () => {
  await resetDatabase();
  received.length = 0;
  auth = bearer(await createUser());
});

const execute = (body: Record<string, unknown>, server = app) =>
  request(server).post('/api/requests/execute').set('Authorization', auth).send(body);

describe('POST /api/requests/execute', () => {
  it('sends a real request and reports status, headers, body, size and timing', async () => {
    const res = await execute({ method: 'GET', url: `${base}/json` }).expect(200);
    const result = res.body.data;
    expect(result).toMatchObject({
      status: 200,
      statusText: 'OK',
      ok: true,
      bodyEncoding: 'utf8',
      error: null,
      redirects: 0,
    });
    expect(JSON.parse(result.body)).toEqual({ ok: true });
    expect(result.headers).toContainEqual({ key: 'X-Target', value: 'yes' });
    expect(result.sizeBytes).toBe(11);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.contentType).toBe('application/json');
    expect(received[0]?.headers['user-agent']).toMatch(/AetherApiStudio/);
  });

  it('forwards method, query params, headers, auth and JSON body', async () => {
    const res = await execute({
      method: 'POST',
      url: `${base}/echo`,
      queryParams: [
        { key: 'page', value: '2', enabled: true },
        { key: 'skip', value: 'me', enabled: false },
      ],
      headers: [{ key: 'X-Trace', value: 'abc', enabled: true }],
      bodyType: 'JSON',
      body: '{"hello":"world"}',
      auth: { type: 'BEARER', token: 'secret-token' },
    }).expect(200);

    expect(res.body.data.status).toBe(201);
    expect(JSON.parse(res.body.data.body)).toEqual({ method: 'POST', query: { page: '2' }, body: '{"hello":"world"}' });
    expect(received[0]?.headers).toMatchObject({
      authorization: 'Bearer secret-token',
      'x-trace': 'abc',
      'content-type': 'application/json',
    });
  });

  it('stores history with credentials masked', async () => {
    const res = await execute({
      method: 'GET',
      url: `${base}/json`,
      auth: { type: 'BASIC', username: 'a', password: 'b' },
    }).expect(200);
    const entry = await request(app)
      .get(`/api/history/${res.body.data.historyId}`)
      .set('Authorization', auth)
      .expect(200);
    expect(entry.body.data.statusCode).toBe(200);
    expect(entry.body.data.requestHeaders).toContainEqual({ key: 'Authorization', value: '••••••' });

    await execute({ method: 'GET', url: `${base}/json`, saveToHistory: false }).expect(200);
    expect((await request(app).get('/api/history').set('Authorization', auth)).body.meta.total).toBe(1);
  });

  it('follows redirects unless told not to', async () => {
    const followed = await execute({ method: 'GET', url: `${base}/redirect` }).expect(200);
    expect(followed.body.data).toMatchObject({ status: 200, redirects: 1, finalUrl: `${base}/json` });
    const raw = await execute({ method: 'GET', url: `${base}/redirect`, followRedirects: false }).expect(200);
    expect(raw.body.data.status).toBe(302);
  });

  it('decodes compressed bodies and base64-encodes binary ones', async () => {
    const gzip = await execute({ method: 'GET', url: `${base}/gzip` }).expect(200);
    expect(JSON.parse(gzip.body.data.body)).toEqual({ compressed: true });
    const binary = await execute({ method: 'GET', url: `${base}/binary` }).expect(200);
    expect(binary.body.data).toMatchObject({
      bodyEncoding: 'base64',
      body: Buffer.from([0, 1, 2, 255]).toString('base64'),
    });
  });

  it('reports timeouts and connection failures as results, not server errors', async () => {
    const slow = await execute({ method: 'GET', url: `${base}/slow`, timeoutMs: 300 }).expect(200);
    expect(slow.body.data).toMatchObject({ status: 0, ok: false, error: { code: 'TIMEOUT' } });
    const refused = await execute({ method: 'GET', url: `http://127.0.0.1:${closedPort}/` }).expect(200);
    expect(refused.body.data.error.code).toBe('CONNECTION_REFUSED');
  });

  it('caps the response size', async () => {
    const small = createApp({ metricsRecorder: null, executorPolicy: policy({ maxResponseBytes: 1024 }) });
    const res = await execute({ method: 'GET', url: `${base}/big` }, small).expect(200);
    expect(res.body.data).toMatchObject({ truncated: true, sizeBytes: 1024 });
  });

  it('validates the URL, protocol and headers', async () => {
    const relative = await execute({ method: 'GET', url: '/just/a/path' }).expect(400);
    expect(relative.body.error.details[0].path).toBe('body.url');
    await execute({ method: 'GET', url: 'ftp://files.example.com' }).expect(400);
    const header = await execute({
      method: 'GET',
      url: `${base}/json`,
      headers: [{ key: 'Bad Header', value: 'x', enabled: true }],
    }).expect(400);
    expect(header.body.error.details[0].path).toBe('body.headers.0.key');
    await execute({ method: 'TRACE', url: `${base}/json` }).expect(400);
  });

  it('requires authentication and applies a per-user rate limit', async () => {
    await request(app)
      .post('/api/requests/execute')
      .send({ method: 'GET', url: `${base}/json` })
      .expect(401);
    const limited = createApp({
      metricsRecorder: null,
      executorPolicy: policy(),
      executorRateLimit: { windowMs: 60_000, limit: 1 },
    });
    await execute({ method: 'GET', url: `${base}/json` }, limited).expect(200);
    const blocked = await execute({ method: 'GET', url: `${base}/json` }, limited).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('SSRF protection', () => {
  it.each([
    ['loopback IP', () => `${base}/json`],
    ['localhost name', () => `http://localhost:${new URL(base).port}/json`],
    ['cloud metadata', () => 'http://169.254.169.254/latest/meta-data'],
    ['private range', () => 'http://10.0.0.5/'],
    ['IPv6 loopback', () => `http://[::1]:${new URL(base).port}/`],
    ['IPv4-mapped IPv6', () => `http://[::ffff:127.0.0.1]:${new URL(base).port}/`],
  ])('blocks %s targets when private networks are disallowed', async (_case, url) => {
    const res = await execute({ method: 'GET', url: url() }, lockedDown).expect(400);
    expect(res.body.error.code).toBe('TARGET_NOT_ALLOWED');
    expect(received).toHaveLength(0);
  });

  it('allows explicitly allow-listed hosts but re-checks every redirect hop', async () => {
    const allowListed = createApp({
      metricsRecorder: null,
      executorPolicy: policy({ allowPrivateNetworks: false, allowedHosts: ['127.0.0.1'] }),
    });
    await execute({ method: 'GET', url: `${base}/json` }, allowListed).expect(200);
    const hop = await execute({ method: 'GET', url: `${base}/redirect-internal` }, allowListed).expect(400);
    expect(hop.body.error.code).toBe('TARGET_NOT_ALLOWED');
  });

  it('classifies addresses correctly', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:7f00:1',
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
    for (const address of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});
