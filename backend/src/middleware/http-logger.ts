import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/** Reuse a well-formed incoming X-Request-Id (for tracing across services) or mint a new one. */
export function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
  const header = req.headers[REQUEST_ID_HEADER];
  const incoming = Array.isArray(header) ? header[0] : header;
  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

const originalUrl = (req: IncomingMessage) =>
  (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url;

/** Structured access log; every line carries the request id. */
export const httpLogger = pinoHttp({
  logger,
  genReqId: resolveRequestId,
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res, responseTime) =>
    `${req.method} ${originalUrl(req)} → ${res.statusCode} in ${Math.round(responseTime)}ms`,
  customErrorMessage: (req, res, err) => `${req.method} ${originalUrl(req)} → ${res.statusCode} (${err.message})`,
  // Minimal serializers: never log headers (tokens, cookies) or bodies.
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
