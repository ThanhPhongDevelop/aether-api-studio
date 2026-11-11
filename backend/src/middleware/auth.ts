import type { RequestHandler } from 'express';
import { prisma } from '../config/database.js';
import type { AuthUser, RoleName } from '../models/user.model.js';
import { verifyAccessToken } from '../services/token.service.js';
import { AppError, ErrorCode } from '../utils/app-error.js';

const BEARER = /^Bearer\s+(\S+)\s*$/i;

async function resolveUser(header: string): Promise<AuthUser> {
  const token = BEARER.exec(header)?.[1];
  if (!token)
    throw AppError.unauthorized('The Authorization header must look like "Bearer <token>"', ErrorCode.INVALID_TOKEN);

  const { userId } = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw AppError.unauthorized('This account no longer exists or has been deactivated', ErrorCode.INVALID_TOKEN);
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Requires a valid access token; attaches the user to `req.user`. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header) throw AppError.unauthorized('Sign in to use this endpoint — send "Authorization: Bearer <token>"');
  req.user = await resolveUser(header);
  next();
};

/** Public endpoint that behaves differently for signed-in users (an invalid token is still rejected). */
export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (header) req.user = await resolveUser(header);
  next();
};

export function authorize(...roles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden('This action requires an administrator account');
    next();
  };
}

/** For `/users/:id`: admins can act on anyone, users only on themselves. */
export const selfOrAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) throw AppError.unauthorized();
  if (req.user.role !== 'ADMIN' && req.user.id !== Number(req.params.id)) {
    throw AppError.forbidden('You can only access your own account');
  }
  next();
};
