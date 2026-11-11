import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import type { User } from '../generated/prisma/client.js';
import type { ClientInfo } from '../models/auth.model.js';
import type { RoleName } from '../models/user.model.js';
import { AppError, ErrorCode } from '../utils/app-error.js';
import { durationToSeconds } from '../utils/duration.js';

const ISSUER = 'aether-api';
const AUDIENCE = 'aether-web';
/** Two tabs refreshing at the same moment both present the same token; allow that briefly. */
const REUSE_GRACE_MS = 10_000;

export const accessTokenTtlSeconds = () => durationToSeconds(env.JWT_ACCESS_EXPIRES_IN);
const refreshTokenTtlMs = () => durationToSeconds(env.JWT_REFRESH_EXPIRES_IN) * 1000;

export function signAccessToken(user: Pick<User, 'id' | 'role'>): string {
  return jwt.sign({ role: user.role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    subject: String(user.id),
    expiresIn: accessTokenTtlSeconds(),
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): { userId: number; role: RoleName } {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Access token has expired', ErrorCode.TOKEN_EXPIRED);
    }
    throw AppError.unauthorized('Access token is invalid', ErrorCode.INVALID_TOKEN);
  }

  const userId = Number(payload.sub);
  if (payload.type !== 'access' || !Number.isInteger(userId) || userId <= 0) {
    throw AppError.unauthorized('Access token is invalid', ErrorCode.INVALID_TOKEN);
  }
  return { userId, role: payload.role as RoleName };
}

/** Refresh tokens are opaque random strings; only an HMAC of them is stored. */
export const hashRefreshToken = (token: string): string =>
  createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');

export interface IssuedRefreshToken {
  id: string;
  token: string;
  expiresAt: Date;
}

export async function issueRefreshToken(
  userId: number,
  client: ClientInfo,
  family: string = randomUUID(),
): Promise<IssuedRefreshToken> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs());
  const record = await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(token),
      family,
      userId,
      expiresAt,
      userAgent: client.userAgent?.slice(0, 255) ?? null,
      ipAddress: client.ipAddress,
    },
  });
  return { id: record.id, token, expiresAt };
}

/**
 * Exchange a refresh token for a new one (rotation). Presenting a token that was
 * already rotated means it may have been stolen, so the whole chain is revoked.
 */
export async function rotateRefreshToken(token: string, client: ClientInfo) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    include: { user: true },
  });
  if (!record) {
    throw AppError.unauthorized('Your session has expired. Please sign in again.', ErrorCode.INVALID_REFRESH_TOKEN);
  }

  if (record.revokedAt) {
    const withinGrace = record.replacedById !== null && Date.now() - record.revokedAt.getTime() < REUSE_GRACE_MS;
    if (!withinGrace) {
      await revokeFamily(record.family);
      throw AppError.unauthorized(
        'This session was signed out for your security. Please sign in again.',
        ErrorCode.REFRESH_TOKEN_REUSED,
      );
    }
  } else if (record.expiresAt <= new Date()) {
    throw AppError.unauthorized('Your session has expired. Please sign in again.', ErrorCode.INVALID_REFRESH_TOKEN);
  }

  if (!record.user.isActive) {
    await revokeFamily(record.family);
    throw new AppError(403, ErrorCode.ACCOUNT_DISABLED, 'This account has been deactivated');
  }

  const next = await issueRefreshToken(record.userId, client, record.family);
  if (!record.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: next.id },
    });
  }
  return { user: record.user, refresh: next };
}

export async function revokeFamily(family: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { family, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeByToken(token: string): Promise<void> {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(token) } });
  if (record) await revokeFamily(record.family);
}

export async function revokeAllForUser(userId: number): Promise<number> {
  const { count } = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}
