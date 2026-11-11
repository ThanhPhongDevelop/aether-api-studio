import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import type { User } from '../generated/prisma/client.js';
import type {
  ChangePasswordInput,
  ClientInfo,
  LoginInput,
  RegisterInput,
  SessionPayload,
  UpdateProfileInput,
} from '../models/auth.model.js';
import { toPublicUser } from '../models/user.model.js';
import { AppError, ErrorCode } from '../utils/app-error.js';
import { equalizeTiming, hashPassword, verifyPassword } from '../utils/password.js';
import { notify } from './notification.service.js';
import { provisionStarterWorkspace } from './starter-workspace.js';
import {
  accessTokenTtlSeconds,
  issueRefreshToken,
  revokeAllForUser,
  revokeByToken,
  rotateRefreshToken,
  signAccessToken,
  type IssuedRefreshToken,
} from './token.service.js';

export interface Session extends SessionPayload {
  refresh: IssuedRefreshToken;
}

const invalidCredentials = () =>
  AppError.unauthorized('The email or password is incorrect', ErrorCode.INVALID_CREDENTIALS);

async function startSession(user: User, client: ClientInfo): Promise<Session> {
  const refresh = await issueRefreshToken(user.id, client);
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    tokenType: 'Bearer',
    expiresIn: accessTokenTtlSeconds(),
    refresh,
  };
}

export async function register(input: RegisterInput, client: ClientInfo): Promise<Session> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw AppError.conflict('An account with this email already exists', { fields: ['email'] });

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        settings: { create: {} },
        notifications: {
          create: {
            type: 'SUCCESS',
            title: 'Welcome to Aether API Studio',
            message:
              'Your Quick Start collection and "Local" environment are ready. Open the API Tester to send your first request.',
            link: '/tester',
          },
        },
      },
    });
    await provisionStarterWorkspace(tx, created.id, created.email);
    return created;
  });
  return startSession(user, client);
}

export async function login(input: LoginInput, client: ClientInfo): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await equalizeTiming(input.password);
    throw invalidCredentials();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(
      429,
      ErrorCode.ACCOUNT_LOCKED,
      `Too many failed sign-in attempts. Try again in ${minutes} minute(s).`,
      {
        details: { retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000) },
      },
    );
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= env.LOGIN_MAX_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failures,
        lockedUntil: lock ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60_000) : null,
      },
    });
    if (lock) {
      await notify(user.id, {
        type: 'WARNING',
        title: 'Account temporarily locked',
        message: `Sign-in was locked for ${env.LOGIN_LOCK_MINUTES} minutes after ${env.LOGIN_MAX_ATTEMPTS} failed attempts.`,
      });
      throw new AppError(
        429,
        ErrorCode.ACCOUNT_LOCKED,
        `Too many failed sign-in attempts. Try again in ${env.LOGIN_LOCK_MINUTES} minute(s).`,
        { details: { retryAfterSeconds: env.LOGIN_LOCK_MINUTES * 60 } },
      );
    }
    throw invalidCredentials();
  }

  // Checked only after the password, so disabled accounts cannot be discovered by guessing.
  if (!user.isActive) throw new AppError(403, ErrorCode.ACCOUNT_DISABLED, 'This account has been deactivated');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  return startSession(updated, client);
}

export async function refresh(token: string | undefined, client: ClientInfo): Promise<Session> {
  if (!token) throw AppError.unauthorized('No active session', ErrorCode.INVALID_REFRESH_TOKEN);
  const { user, refresh: next } = await rotateRefreshToken(token, client);
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    tokenType: 'Bearer',
    expiresIn: accessTokenTtlSeconds(),
    refresh: next,
  };
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await revokeByToken(token);
}

export async function logoutEverywhere(userId: number): Promise<{ revokedSessions: number }> {
  return { revokedSessions: await revokeAllForUser(userId) };
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User');
  return toPublicUser(user);
}

export async function updateProfile(userId: number, input: UpdateProfileInput) {
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  return toPublicUser(user);
}

/** Changing the password signs out every other session and starts a fresh one here. */
export async function changePassword(userId: number, input: ChangePasswordInput, client: ClientInfo): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User');
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw AppError.validation([{ path: 'body.currentPassword', message: 'is incorrect', code: 'invalid_password' }]);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  await revokeAllForUser(userId);
  await notify(userId, {
    type: 'SUCCESS',
    title: 'Password changed',
    message: 'Your password was updated and other sessions were signed out.',
  });
  return startSession(updated, client);
}
