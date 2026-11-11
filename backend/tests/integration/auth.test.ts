import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { bearer, issuePaths, refreshCookie } from '../helpers/auth.js';
import { createUser, resetDatabase } from '../helpers/db.js';

const app = createApp({ metricsRecorder: null });
const PASSWORD = 'Test@123456';

beforeEach(resetDatabase);

const login = (email: string, password = PASSWORD) => request(app).post('/api/auth/login').send({ email, password });

describe('POST /api/auth/register', () => {
  it('creates an account, returns an access token and sets a hardened refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Linh Tran', email: 'Linh@Example.com', password: 'Strong@Pass1' })
      .expect(201);

    expect(res.body.data).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: 'linh@example.com', name: 'Linh Tran', role: 'USER', isActive: true },
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toMatch(/^eyJ/);

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((value) => value.startsWith('aether_rt='));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
    expect(await prisma.notification.count({ where: { userId: res.body.data.user.id } })).toBe(1);
    expect(await prisma.userSettings.count({ where: { userId: res.body.data.user.id } })).toBe(1);
  });

  it('gives a new account the Quick Start collection and an active Local environment', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Starter', email: 'starter@example.com', password: 'Strong@Pass1' })
      .expect(201);
    const auth = `Bearer ${res.body.data.accessToken}`;

    const collections = await request(app).get('/api/collections').set('Authorization', auth).expect(200);
    expect(collections.body.data).toHaveLength(1);
    expect(collections.body.data[0].name).toBe('Quick Start');
    const login = collections.body.data[0].requests.find((item: { name: string }) => item.name.startsWith('Login'));
    // The account's email is pre-filled; its password is never stored in a saved request.
    expect(JSON.parse(login.body)).toEqual({ email: 'starter@example.com', password: '' });

    const environments = await request(app).get('/api/environments').set('Authorization', auth).expect(200);
    expect(environments.body.data).toEqual([
      expect.objectContaining({
        name: 'Local',
        isActive: true,
        variables: expect.arrayContaining([
          expect.objectContaining({ key: 'baseUrl', value: 'http://localhost:4000/api' }),
        ]),
      }),
    ]);
  });

  it('rejects a duplicate email with 409 CONFLICT', async () => {
    await createUser({ email: 'taken@test.dev' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Someone', email: 'TAKEN@test.dev', password: 'Strong@Pass1' })
      .expect(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', details: { fields: ['email'] } });
  });

  it('reports every missing field at once', async () => {
    const res = await request(app).post('/api/auth/register').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(issuePaths(res)).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
  });

  it('enforces the password policy and email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'not-an-email', password: 'password' })
      .expect(400);
    const messages = res.body.error.details.map((issue: { message: string }) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'must be a valid email address',
        'must contain an uppercase letter',
        'must contain a number',
      ]),
    );
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with valid credentials and records the login time', async () => {
    const user = await createUser({ email: 'demo@test.dev' });
    const res = await login('DEMO@test.dev').expect(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.accessToken).toBeTruthy();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).not.toBeNull();
  });

  it('gives the same 401 answer for a wrong password and an unknown email', async () => {
    await createUser({ email: 'demo@test.dev' });
    const wrong = await login('demo@test.dev', 'Wrong@123456').expect(401);
    const unknown = await login('nobody@test.dev').expect(401);
    expect(wrong.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('locks the account after repeated failures, even for the right password', async () => {
    await createUser({ email: 'target@test.dev' });
    for (let attempt = 1; attempt < env.LOGIN_MAX_ATTEMPTS; attempt += 1) {
      await login('target@test.dev', 'Wrong@123456').expect(401);
    }
    const locked = await login('target@test.dev', 'Wrong@123456').expect(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
    await login('target@test.dev').expect(429);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'target@test.dev' } });
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('refuses deactivated accounts with 403 after checking the password', async () => {
    const user = await createUser({ email: 'gone@test.dev' });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await login('gone@test.dev', 'Wrong@123456').expect(401);
    const res = await login('gone@test.dev').expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('validates the payload', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: '' }).expect(400);
    expect(issuePaths(res)).toEqual(expect.arrayContaining(['body.email', 'body.password']));
  });
});

describe('GET /api/auth/profile — token handling', () => {
  it('returns the current user for a valid token', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/auth/profile').set('Authorization', bearer(user)).expect(200);
    expect(res.body.data).toMatchObject({ id: user.id, email: user.email });
  });

  it('answers 401 UNAUTHORIZED without a token', async () => {
    const res = await request(app).get('/api/auth/profile').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it.each([
    ['a non-Bearer scheme', 'Token abc.def'],
    ['a malformed token', 'Bearer not-a-jwt'],
    [
      'a token signed with another secret',
      `Bearer ${jwt.sign({ type: 'access', role: 'ADMIN' }, 'x'.repeat(40), { subject: '1' })}`,
    ],
  ])('answers 401 INVALID_TOKEN for %s', async (_case, header) => {
    const res = await request(app).get('/api/auth/profile').set('Authorization', header).expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('answers 401 TOKEN_EXPIRED for an expired token', async () => {
    const user = await createUser();
    const expired = jwt.sign(
      { role: 'USER', type: 'access', exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_ACCESS_SECRET,
      { subject: String(user.id), issuer: 'aether-api', audience: 'aether-web' },
    );
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens of deleted or deactivated users', async () => {
    const user = await createUser();
    const token = bearer(user);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await request(app).get('/api/auth/profile').set('Authorization', token).expect(401);
    await prisma.user.delete({ where: { id: user.id } });
    await request(app).get('/api/auth/profile').set('Authorization', token).expect(401);
  });
});

describe('refresh token rotation', () => {
  it('rotates on every refresh and tolerates a near-simultaneous duplicate', async () => {
    await createUser({ email: 'tabs@test.dev' });
    const first = refreshCookie(await login('tabs@test.dev').expect(200));
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', first).expect(200);
    expect(rotated.body.data.accessToken).toBeTruthy();
    expect(refreshCookie(rotated)).not.toBe(first);
    // A second tab presenting the same token within the grace window is not treated as theft.
    await request(app).post('/api/auth/refresh').set('Cookie', first).expect(200);
  });

  it('revokes the whole session chain when an old token is replayed', async () => {
    await createUser({ email: 'victim@test.dev' });
    const first = refreshCookie(await login('victim@test.dev').expect(200));
    const second = refreshCookie(await request(app).post('/api/auth/refresh').set('Cookie', first).expect(200));
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', first).expect(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    await request(app).post('/api/auth/refresh').set('Cookie', second).expect(401);
  });

  it('answers 401 without a refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh').expect(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('logout revokes the session; logout-all revokes every session', async () => {
    const user = await createUser({ email: 'multi@test.dev' });
    const phone = refreshCookie(await login('multi@test.dev').expect(200));
    const laptop = refreshCookie(await login('multi@test.dev').expect(200));

    await request(app).post('/api/auth/logout').set('Cookie', phone).expect(200);
    await request(app).post('/api/auth/refresh').set('Cookie', phone).expect(401);
    await request(app).post('/api/auth/refresh').set('Cookie', laptop).expect(200);

    const all = await request(app).post('/api/auth/logout-all').set('Authorization', bearer(user)).expect(200);
    expect(all.body.data.revokedSessions).toBeGreaterThan(0);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });
});

describe('profile and password', () => {
  it('updates the profile and validates fields', async () => {
    const user = await createUser();
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', bearer(user))
      .send({ name: 'Renamed', bio: 'Hello', avatarUrl: 'https://example.com/me.png' })
      .expect(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed', bio: 'Hello', avatarUrl: 'https://example.com/me.png' });

    const invalid = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', bearer(user))
      .send({ avatarUrl: 'javascript:alert(1)' })
      .expect(400);
    expect(issuePaths(invalid)).toEqual(['body.avatarUrl']);
    await request(app).patch('/api/auth/profile').set('Authorization', bearer(user)).send({}).expect(400);
  });

  it('changes the password, signs out other sessions and keeps this one', async () => {
    const user = await createUser({ email: 'change@test.dev' });
    const oldSession = refreshCookie(await login('change@test.dev').expect(200));

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', bearer(user))
      .send({ currentPassword: 'Nope@123456', newPassword: 'Fresh@654321' })
      .expect(400);
    expect(issuePaths(wrong)).toEqual(['body.currentPassword']);

    const changed = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', bearer(user))
      .send({ currentPassword: PASSWORD, newPassword: 'Fresh@654321' })
      .expect(200);
    expect(refreshCookie(changed)).toBeTruthy();

    await request(app).post('/api/auth/refresh').set('Cookie', oldSession).expect(401);
    await login('change@test.dev').expect(401);
    await login('change@test.dev', 'Fresh@654321').expect(200);
  });
});

describe('credential rate limiting', () => {
  it('limits login attempts per IP', async () => {
    const limited = createApp({ metricsRecorder: null, authRateLimit: { windowMs: 60_000, limit: 2 } });
    await createUser({ email: 'rl@test.dev' });
    await request(limited).post('/api/auth/login').send({ email: 'rl@test.dev', password: PASSWORD }).expect(200);
    await request(limited).post('/api/auth/login').send({ email: 'rl@test.dev', password: PASSWORD }).expect(200);
    const blocked = await request(limited)
      .post('/api/auth/login')
      .send({ email: 'rl@test.dev', password: PASSWORD })
      .expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
