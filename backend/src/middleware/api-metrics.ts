import type { RequestHandler } from 'express';
import type { ApiMetricsRecorder } from '../services/metrics.service.js';
import { roundTo } from '../utils/format.js';

/** Paths excluded from traffic metrics (infrastructure probes would drown real traffic). */
const IGNORED_PATHS = new Set(['/api/health']);

/** `/api` + `/` → `/api`, `/api` + `/users/:id` → `/api/users/:id`. */
export function joinRoute(base: string, routePath: string): string {
  return `${base}${routePath === '/' ? '' : routePath}` || '/';
}

/**
 * Records method, path, matched route pattern, status and latency for every API
 * request once the response has been sent.
 */
export function apiMetrics(recorder: ApiMetricsRecorder): RequestHandler {
  return (req, res, next) => {
    const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
    if (req.method === 'OPTIONS' || IGNORED_PATHS.has(path)) return next();

    const startedAt = process.hrtime.bigint();
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const base = res.locals.routeBase ?? req.baseUrl;
      const route = req.route ? joinRoute(base, String(req.route.path)) : null;

      recorder.record({
        method: req.method,
        path: path.slice(0, 255),
        route,
        statusCode: res.statusCode,
        durationMs: roundTo(durationMs, 3),
        userId: req.user?.id ?? null,
        userAgent: req.get('user-agent')?.slice(0, 255) ?? null,
        createdAt: new Date(),
      });
    });
    next();
  };
}
