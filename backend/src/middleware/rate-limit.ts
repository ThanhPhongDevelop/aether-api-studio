import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError, ErrorCode } from '../utils/app-error.js';

export interface RateLimitConfig {
  windowMs: number;
  limit: number;
}

interface LimiterOptions {
  skip?: (req: Request) => boolean;
  /** Count per signed-in user instead of per IP address. */
  perUser?: boolean;
  message?: string;
}

/**
 * Fixed-window limiter that answers with the standard error envelope plus
 * IETF `RateLimit` / `RateLimit-Policy` / `Retry-After` headers.
 */
export function createRateLimiter(config: RateLimitConfig, options: LimiterOptions = {}) {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(options.skip ? { skip: options.skip } : {}),
    ...(options.perUser
      ? { keyGenerator: (req: Request) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? '')) }
      : {}),
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          ErrorCode.RATE_LIMITED,
          options.message ?? 'Too many requests — please slow down and try again later',
          { details: { limit: config.limit, windowSeconds: Math.round(config.windowMs / 1000) } },
        ),
      );
    },
  });
}
