import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { bearer, issuePaths } from '../helpers/auth.js';
import { createUser, resetDatabase } from '../helpers/db.js';

const app = createApp({ metricsRecorder: null });

let owner: Awaited<ReturnType<typeof createUser>>;
let stranger: Awaited<ReturnType<typeof createUser>>;
let auth: string;

beforeEach(async () => {
  await resetDatabase();
  owner = await createUser();
  stranger = await createUser();
  auth = bearer(owner);
});

const savedRequest = (collectionId: string | null) => ({
  name: 'Get profile',
  method: 'GET',
  url: '{{baseUrl}}/auth/profile',
  headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
  queryParams: [],
  bodyType: 'NONE',
  body: null,
  auth: { type: 'BEARER', token: '{{accessToken}}' },
  collectionId,
});

describe('collections and saved requests', () => {
  it('supports the full lifecycle', async () => {
    const created = await request(app)
      .post('/api/collections')
      .set('Authorization', auth)
      .send({ name: 'Payments' })
      .expect(201);
    const collectionId = created.body.data.id as string;
    expect(created.body.data).toMatchObject({ name: 'Payments', description: null, requests: [] });

    const saved = await request(app)
      .post('/api/saved-requests')
      .set('Authorization', auth)
      .send(savedRequest(collectionId))
      .expect(201);
    expect(saved.body.data).toMatchObject({
      auth: { type: 'BEARER', token: '{{accessToken}}' },
      sortOrder: 0,
      collectionId,
    });

    const list = await request(app).get('/api/collections').set('Authorization', auth).expect(200);
    expect(list.body.data[0].requests).toHaveLength(1);

    const updated = await request(app)
      .put(`/api/saved-requests/${saved.body.data.id}`)
      .set('Authorization', auth)
      .send({
        ...savedRequest(collectionId),
        name: 'Renamed',
        method: 'POST',
        bodyType: 'JSON',
        body: '{"a":1}',
        auth: { type: 'NONE' },
      })
      .expect(200);
    expect(updated.body.data).toMatchObject({ name: 'Renamed', method: 'POST', auth: { type: 'NONE' } });

    await request(app)
      .patch(`/api/collections/${collectionId}`)
      .set('Authorization', auth)
      .send({ name: 'Payments v2' })
      .expect(200);
    await request(app).delete(`/api/collections/${collectionId}`).set('Authorization', auth).expect(200);
    expect(await prisma.savedRequest.count()).toBe(0);
  });

  it('isolates workspaces between users', async () => {
    const created = await request(app)
      .post('/api/collections')
      .set('Authorization', auth)
      .send({ name: 'Private' })
      .expect(201);
    await request(app)
      .get(`/api/collections/${created.body.data.id}`)
      .set('Authorization', bearer(stranger))
      .expect(404);
    const foreign = await request(app)
      .post('/api/saved-requests')
      .set('Authorization', bearer(stranger))
      .send(savedRequest(created.body.data.id))
      .expect(400);
    expect(issuePaths(foreign)).toEqual(['body.collectionId']);
  });

  it('rejects duplicate names and invalid requests', async () => {
    await request(app).post('/api/collections').set('Authorization', auth).send({ name: 'Same' }).expect(201);
    await request(app).post('/api/collections').set('Authorization', auth).send({ name: 'Same' }).expect(409);
    const invalid = await request(app)
      .post('/api/saved-requests')
      .set('Authorization', auth)
      .send({ name: '', method: 'FETCH', url: '', auth: { type: 'OAUTH' } })
      .expect(400);
    expect(issuePaths(invalid)).toEqual(expect.arrayContaining(['body.name', 'body.method', 'body.url']));
    await request(app).get('/api/saved-requests/unknown-id').set('Authorization', auth).expect(404);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/collections').expect(401);
    await request(app).get('/api/saved-requests').expect(401);
  });
});

describe('environments', () => {
  const variables = [
    { key: 'baseUrl', value: 'http://localhost:4000/api' },
    { key: 'token', value: 'secret', isSecret: true },
  ];

  it('creates, activates, replaces and deletes environments', async () => {
    const local = await request(app)
      .post('/api/environments')
      .set('Authorization', auth)
      .send({ name: 'Local', variables })
      .expect(201);
    expect(local.body.data.isActive).toBe(true);
    expect(local.body.data.variables).toHaveLength(2);

    const staging = await request(app)
      .post('/api/environments')
      .set('Authorization', auth)
      .send({ name: 'Staging' })
      .expect(201);
    expect(staging.body.data.isActive).toBe(false);

    await request(app)
      .post(`/api/environments/${staging.body.data.id}/activate`)
      .set('Authorization', auth)
      .expect(200);
    const list = await request(app).get('/api/environments').set('Authorization', auth).expect(200);
    expect(list.body.data.map((env: { name: string; isActive: boolean }) => [env.name, env.isActive])).toEqual([
      ['Local', false],
      ['Staging', true],
    ]);

    const replaced = await request(app)
      .put(`/api/environments/${local.body.data.id}`)
      .set('Authorization', auth)
      .send({ name: 'Local', variables: [{ key: 'baseUrl', value: 'http://127.0.0.1:4000/api' }] })
      .expect(200);
    expect(replaced.body.data.variables).toEqual([
      expect.objectContaining({ key: 'baseUrl', value: 'http://127.0.0.1:4000/api', isSecret: false, enabled: true }),
    ]);

    await request(app).post('/api/environments/deactivate').set('Authorization', auth).expect(200);
    expect(await prisma.environment.count({ where: { isActive: true } })).toBe(0);
    await request(app).delete(`/api/environments/${staging.body.data.id}`).set('Authorization', auth).expect(200);
  });

  it('validates variable keys and rejects duplicates', async () => {
    const res = await request(app)
      .post('/api/environments')
      .set('Authorization', auth)
      .send({ name: 'Bad', variables: [{ key: 'a b' }, { key: 'x' }, { key: 'x' }] })
      .expect(400);
    expect(issuePaths(res)).toEqual(expect.arrayContaining(['body.variables.0.key', 'body.variables.2.key']));
  });
});

describe('history', () => {
  beforeEach(async () => {
    const base = { userId: owner.id, durationMs: 12, responseSize: 10 };
    await prisma.requestHistory.createMany({
      data: [
        { ...base, method: 'GET', url: 'https://api.test/users', statusCode: 200, statusText: 'OK' },
        { ...base, method: 'POST', url: 'https://api.test/orders', statusCode: 422, statusText: 'Unprocessable' },
        { ...base, method: 'GET', url: 'https://down.test/', statusCode: null, errorMessage: 'Connection refused' },
        { ...base, userId: stranger.id, method: 'GET', url: 'https://api.test/secret', statusCode: 200 },
      ],
    });
  });

  it('lists only your entries with filters', async () => {
    const all = await request(app).get('/api/history').set('Authorization', auth).expect(200);
    expect(all.body.meta.total).toBe(3);
    const errors = await request(app).get('/api/history?status=error').set('Authorization', auth).expect(200);
    expect(errors.body.data).toHaveLength(2);
    const posts = await request(app)
      .get('/api/history?method=POST&search=orders')
      .set('Authorization', auth)
      .expect(200);
    expect(posts.body.data.map((entry: { url: string }) => entry.url)).toEqual(['https://api.test/orders']);
  });

  it('reads, deletes and clears entries', async () => {
    const [first] = (await request(app).get('/api/history').set('Authorization', auth)).body.data;
    const detail = await request(app).get(`/api/history/${first.id}`).set('Authorization', auth).expect(200);
    expect(detail.body.data).toHaveProperty('responseHeaders');
    await request(app).delete(`/api/history/${first.id}`).set('Authorization', auth).expect(200);
    const cleared = await request(app).delete('/api/history').set('Authorization', auth).expect(200);
    expect(cleared.body.data.deleted).toBe(2);
    expect(await prisma.requestHistory.count({ where: { userId: stranger.id } })).toBe(1);
  });
});

describe('settings and notifications', () => {
  it('reads defaults and updates settings with validation', async () => {
    const defaults = await request(app).get('/api/settings').set('Authorization', auth).expect(200);
    expect(defaults.body.data).toMatchObject({ theme: 'DARK', enable3dEffects: true, requestTimeoutMs: 30000 });
    const updated = await request(app)
      .patch('/api/settings')
      .set('Authorization', auth)
      .send({ theme: 'LIGHT', requestTimeoutMs: 5000 })
      .expect(200);
    expect(updated.body.data).toMatchObject({ theme: 'LIGHT', requestTimeoutMs: 5000 });
    const invalid = await request(app)
      .patch('/api/settings')
      .set('Authorization', auth)
      .send({ theme: 'NEON', requestTimeoutMs: 10 })
      .expect(400);
    expect(issuePaths(invalid)).toEqual(expect.arrayContaining(['body.theme', 'body.requestTimeoutMs']));
  });

  it('skips informational notifications when they are turned off, but keeps security warnings', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await request(app)
      .patch('/api/settings')
      .set('Authorization', auth)
      .send({ notificationsEnabled: false })
      .expect(200);
    expect(await notify(owner.id, { type: 'SUCCESS', title: 'Saved', message: 'Nice' })).toBeNull();
    expect(await notify(owner.id, { type: 'WARNING', title: 'Locked', message: 'Too many attempts' })).not.toBeNull();
    const titles = (await prisma.notification.findMany({ where: { userId: owner.id } })).map((item) => item.title);
    expect(titles).toEqual(['Locked']);
  });

  it('lists, counts, reads and deletes notifications', async () => {
    await prisma.notification.createMany({
      data: [
        { userId: owner.id, title: 'One', message: 'First' },
        { userId: owner.id, title: 'Two', message: 'Second' },
        { userId: stranger.id, title: 'Other', message: 'Not yours' },
      ],
    });
    const list = await request(app).get('/api/notifications').set('Authorization', auth).expect(200);
    expect(list.body.meta).toMatchObject({ total: 2, unreadCount: 2 });

    const target = list.body.data[0].id as string;
    await request(app).patch(`/api/notifications/${target}/read`).set('Authorization', auth).expect(200);
    expect(
      (await request(app).get('/api/notifications/unread-count').set('Authorization', auth)).body.data.unreadCount,
    ).toBe(1);
    await request(app).post('/api/notifications/read-all').set('Authorization', auth).expect(200);
    expect((await request(app).get('/api/notifications?unread=true').set('Authorization', auth)).body.meta.total).toBe(
      0,
    );

    const foreign = await prisma.notification.findFirstOrThrow({ where: { userId: stranger.id } });
    await request(app).delete(`/api/notifications/${foreign.id}`).set('Authorization', auth).expect(404);
    await request(app).delete(`/api/notifications/${target}`).set('Authorization', auth).expect(200);
  });
});
