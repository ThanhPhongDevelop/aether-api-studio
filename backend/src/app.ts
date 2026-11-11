import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { createCorsOptions } from './config/cors.js';
import { BACKEND_ROOT, env, isDevelopment } from './config/env.js';
import { apiMetrics } from './middleware/api-metrics.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createRateLimiter, type RateLimitConfig } from './middleware/rate-limit.js';
import { createApiRouter } from './routes/index.js';
import type { ExecutorPolicy } from './services/executor.service.js';
import { apiMetricsRecorder, type ApiMetricsRecorder } from './services/metrics.service.js';
import { sendSuccess } from './utils/http-response.js';

export interface AppOptions {
  /** Global per-IP limit for /api (tests use tiny windows). */
  rateLimit?: RateLimitConfig;
  /** Per-IP limit for register, login and change-password. */
  authRateLimit?: RateLimitConfig;
  /** Per-user limit for the API Tester executor. */
  executorRateLimit?: RateLimitConfig;
  /** Metrics recorder to use; `null` disables traffic metrics. */
  metricsRecorder?: ApiMetricsRecorder | null;
  /** Override the executor's network policy (tests). */
  executorPolicy?: ExecutorPolicy;
  /** Folder of the built frontend to serve; `null` disables. Defaults to frontend/dist when SERVE_FRONTEND=true. */
  frontendDist?: string | null;
}

const DEFAULT_FRONTEND_DIST = path.resolve(BACKEND_ROOT, '../frontend/dist');

function serveFrontend(app: Express, dist: string) {
  app.use(
    express.static(dist, {
      index: false,
      setHeaders: (res, file) => {
        // Vite fingerprints everything in /assets, so those files can be cached forever.
        if (file.includes(`${path.sep}assets${path.sep}`))
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  // Client-side routes (/dashboard, /tester…) all render the single-page app.
  app.get('/{*path}', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

/**
 * Build the Express application. Kept free of side effects (no `listen`) so
 * integration tests can drive it in-process with Supertest.
 *
 * Pipeline: request id + access log → security headers → CORS → cookies →
 * metrics → rate limit → body parsing → routes → 404 → error handler.
 */
export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('json spaces', isDevelopment ? 2 : 0);

  app.use(httpLogger);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(cors(createCorsOptions(env.CORS_ORIGINS)));
  app.use(cookieParser());

  const recorder = options.metricsRecorder === undefined ? apiMetricsRecorder : options.metricsRecorder;
  if (recorder) app.use('/api', apiMetrics(recorder));

  const limits = options.rateLimit ?? { windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX };
  app.use('/api', createRateLimiter(limits, { skip: (req) => req.path === '/health' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use(
    '/api',
    createApiRouter({
      authRateLimit: options.authRateLimit ?? {
        windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
        limit: env.AUTH_RATE_LIMIT_MAX,
      },
      executorRateLimit: options.executorRateLimit ?? { windowMs: 60_000, limit: env.EXECUTOR_RATE_LIMIT_PER_MINUTE },
      ...(options.executorPolicy ? { executorPolicy: options.executorPolicy } : {}),
    }),
  );

  const dist =
    options.frontendDist === undefined ? (env.SERVE_FRONTEND ? DEFAULT_FRONTEND_DIST : null) : options.frontendDist;
  if (dist && existsSync(path.join(dist, 'index.html'))) {
    serveFrontend(app, dist);
  } else {
    app.get('/', (_req, res) => {
      sendSuccess(res, {
        message: `${env.APP_NAME} is running`,
        api: '/api',
        health: '/api/health',
        docs: '/api/docs',
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
