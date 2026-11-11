import type { Request, Response } from 'express';
import type { ClientInfo } from '../models/auth.model.js';
import type { AuthUser } from '../models/user.model.js';
import { AppError } from './app-error.js';

/** Typed access to the values parsed by the `validate()` middleware. */
export function validated<T>(res: Response, part: 'body' | 'query' | 'params'): T {
  return res.locals.validated?.[part] as T;
}

/** The authenticated user; only call after `authenticate`. */
export function requireUser(req: Request): AuthUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const clientInfo = (req: Request): ClientInfo => ({
  userAgent: req.get('user-agent') ?? null,
  ipAddress: req.ip ?? null,
});
