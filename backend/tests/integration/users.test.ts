import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { bearer, issuePaths } from '../helpers/auth.js';
import { createUser, resetDatabase } from '../helpers/db.js';

const app = createApp({ metricsRecorder: null });

let admin: Awaited<ReturnType<typeof createUser>>;
let member: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ role: 'ADMIN', email: 'admin@test.dev' });
  member = await createUser({ email: 'member@test.dev' });
  await createUser({ email: 'zoe.nguyen@test.dev' });
});

describe('GET /api/users', () => {
  it('lists users with pagination metadata for admins', async () => {
    const res = await request(app).get('/api/users?limit=2&sort=email').set('Authorization', bearer(admin)).expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].email).toBe('admin@test.dev');
    expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data[0].passwordHash).toBeUndefined();
  });

  it('filters by search, role and status', async () => {
    const search = await request(app).get('/api/users?search=nguyen').set('Authorization', bearer(admin)).expect(200);
    expect(search.body.data.map((user: { email: string }) => user.email)).toEqual(['zoe.nguyen@test.dev']);
    const admins = await request(app).get('/api/users?role=ADMIN').set('Authorization', bearer(admin)).expect(200);
    expect(admins.body.meta.total).toBe(1);
    await prisma.user.update({ where: { id: member.id }, data: { isActive: false } });
    const inactive = await request(app)
      .get('/api/users?isActive=false')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(inactive.body.data.map((user: { id: number }) => user.id)).toEqual([member.id]);
  });

  it('rejects invalid query parameters', async () => {
    const res = await request(app)
      .get('/api/users?limit=500&sort=password')
      .set('Authorization', bearer(admin))
      .expect(400);
    expect(issuePaths(res)).toEqual(expect.arrayContaining(['query.limit', 'query.sort']));
  });

  it('is forbidden for regular users and requires a token', async () => {
    const forbidden = await request(app).get('/api/users').set('Authorization', bearer(member)).expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    await request(app).get('/api/users').expect(401);
  });
});

describe('GET /api/users/:id', () => {
  it('lets users read themselves but not others', async () => {
    await request(app).get(`/api/users/${member.id}`).set('Authorization', bearer(member)).expect(200);
    await request(app).get(`/api/users/${admin.id}`).set('Authorization', bearer(member)).expect(403);
  });

  it('returns 404 for unknown ids and 400 for malformed ids', async () => {
    const missing = await request(app).get('/api/users/999999').set('Authorization', bearer(admin)).expect(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'User not found' });
    const malformed = await request(app).get('/api/users/abc').set('Authorization', bearer(admin)).expect(400);
    expect(issuePaths(malformed)).toEqual(['params.id']);
  });
});

describe('POST /api/users', () => {
  it('creates users as admin', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer(admin))
      .send({ name: 'New Admin', email: 'boss@test.dev', password: 'Strong@Pass1', role: 'ADMIN' })
      .expect(201);
    expect(res.body.data).toMatchObject({ email: 'boss@test.dev', role: 'ADMIN', isActive: true });
  });

  it('rejects duplicates, invalid data and non-admins', async () => {
    const duplicate = await request(app)
      .post('/api/users')
      .set('Authorization', bearer(admin))
      .send({ name: 'Copy', email: 'member@test.dev', password: 'Strong@Pass1' })
      .expect(409);
    expect(duplicate.body.error.details).toEqual({ fields: ['email'] });

    const invalid = await request(app)
      .post('/api/users')
      .set('Authorization', bearer(admin))
      .send({ name: 'X', email: 'nope', password: 'short', role: 'ROOT' })
      .expect(400);
    expect(issuePaths(invalid)).toEqual(
      expect.arrayContaining(['body.name', 'body.email', 'body.password', 'body.role']),
    );

    await request(app)
      .post('/api/users')
      .set('Authorization', bearer(member))
      .send({ name: 'Sneaky', email: 'x@test.dev', password: 'Strong@Pass1' })
      .expect(403);
  });
});

describe('PUT and PATCH /api/users/:id', () => {
  it('lets users edit their own profile fields', async () => {
    const res = await request(app)
      .patch(`/api/users/${member.id}`)
      .set('Authorization', bearer(member))
      .send({ bio: 'Testing everything' })
      .expect(200);
    expect(res.body.data.bio).toBe('Testing everything');
  });

  it('forbids users from changing their role or status', async () => {
    const res = await request(app)
      .patch(`/api/users/${member.id}`)
      .set('Authorization', bearer(member))
      .send({ role: 'ADMIN' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('requires name and email for PUT', async () => {
    const res = await request(app)
      .put(`/api/users/${member.id}`)
      .set('Authorization', bearer(member))
      .send({ bio: 'x' })
      .expect(400);
    expect(issuePaths(res)).toEqual(expect.arrayContaining(['body.name', 'body.email']));
  });

  it('deactivating a user invalidates their tokens immediately', async () => {
    const token = bearer(member);
    await request(app)
      .patch(`/api/users/${member.id}`)
      .set('Authorization', bearer(admin))
      .send({ isActive: false })
      .expect(200);
    await request(app).get('/api/auth/profile').set('Authorization', token).expect(401);
  });

  it('keeps at least one active admin', async () => {
    const res = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', bearer(admin))
      .send({ role: 'USER' })
      .expect(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  it('rejects an email that belongs to someone else', async () => {
    await request(app)
      .patch(`/api/users/${member.id}`)
      .set('Authorization', bearer(member))
      .send({ email: 'admin@test.dev' })
      .expect(409);
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes other users as admin', async () => {
    const res = await request(app).delete(`/api/users/${member.id}`).set('Authorization', bearer(admin)).expect(200);
    expect(res.body.data).toEqual({ id: member.id, deleted: true });
    await request(app).get(`/api/users/${member.id}`).set('Authorization', bearer(admin)).expect(404);
  });

  it('refuses self-deletion and non-admin deletion', async () => {
    const self = await request(app).delete(`/api/users/${admin.id}`).set('Authorization', bearer(admin)).expect(409);
    expect(self.body.error.code).toBe('CANNOT_DELETE_SELF');
    await request(app).delete(`/api/users/${admin.id}`).set('Authorization', bearer(member)).expect(403);
  });
});
