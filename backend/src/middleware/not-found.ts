import type { RequestHandler } from 'express';
import { AppError, ErrorCode } from '../utils/app-error.js';

/** Catch-all for unknown routes. Uses `req.path` so query strings (which may carry secrets) are never echoed. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, ErrorCode.ROUTE_NOT_FOUND, `Cannot ${req.method} ${req.path}`));
};
