import type { CookieOptions, Request, Response } from 'express';
import { isProduction } from '../config/env.js';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from '../models/auth.model.js';
import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/http-response.js';
import { clientInfo, requireUser, validated } from '../utils/request.js';

export const REFRESH_COOKIE = 'aether_rt';

/** httpOnly: unreadable by JavaScript (XSS); SameSite=Strict: never sent cross-site (CSRF); scoped to /api/auth. */
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/api/auth',
});

function sendSession(res: Response, session: authService.Session, status = 200) {
  res.cookie(REFRESH_COOKIE, session.refresh.token, { ...cookieOptions(), expires: session.refresh.expiresAt });
  res.setHeader('Cache-Control', 'no-store');
  const { refresh: _refresh, ...payload } = session;
  sendSuccess(res, payload, { status });
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function register(req: Request, res: Response) {
  sendSession(res, await authService.register(validated<RegisterInput>(res, 'body'), clientInfo(req)), 201);
}

export async function login(req: Request, res: Response) {
  sendSession(res, await authService.login(validated<LoginInput>(res, 'body'), clientInfo(req)));
}

export async function refresh(req: Request, res: Response) {
  try {
    sendSession(res, await authService.refresh(readRefreshCookie(req), clientInfo(req)));
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw error;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(readRefreshCookie(req));
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  sendSuccess(res, { signedOut: true });
}

export async function logoutAll(req: Request, res: Response) {
  const result = await authService.logoutEverywhere(requireUser(req).id);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  sendSuccess(res, result);
}

export async function getProfile(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, await authService.getProfile(requireUser(req).id));
}

export async function updateProfile(req: Request, res: Response) {
  sendSuccess(res, await authService.updateProfile(requireUser(req).id, validated<UpdateProfileInput>(res, 'body')));
}

export async function changePassword(req: Request, res: Response) {
  const session = await authService.changePassword(
    requireUser(req).id,
    validated<ChangePasswordInput>(res, 'body'),
    clientInfo(req),
  );
  sendSession(res, session);
}
