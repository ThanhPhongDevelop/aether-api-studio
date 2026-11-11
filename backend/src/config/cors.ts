import type { CorsOptions } from 'cors';

/**
 * Only whitelisted browser origins may call the API with credentials.
 * Requests without an Origin header (curl, server-to-server, the API Tester proxy)
 * are not subject to CORS and pass through.
 */
export function createCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  const allowed = new Set(allowedOrigins);
  return {
    origin: (origin, callback) => callback(null, !origin || allowed.has(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
  };
}
