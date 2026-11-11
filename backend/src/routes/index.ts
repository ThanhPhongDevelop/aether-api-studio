import * as systemController from '../controllers/system.controller.js';
import type { RateLimitConfig } from '../middleware/rate-limit.js';
import type { ExecutorPolicy } from '../services/executor.service.js';
import { createRouter } from '../utils/router.js';
import { createAuthRouter } from './auth.routes.js';
import { notificationRouter, productRouter, settingsRouter, userRouter } from './resource.routes.js';
import { systemRouter } from './system.routes.js';
import {
  collectionRouter,
  createRequestRouter,
  dashboardRouter,
  docsRouter,
  environmentRouter,
  historyRouter,
  savedRequestRouter,
} from './workspace.routes.js';

export interface ApiRouterOptions {
  authRateLimit: RateLimitConfig;
  executorRateLimit: RateLimitConfig;
  executorPolicy?: ExecutorPolicy;
}

/** Root router mounted at `/api`. */
export function createApiRouter(options: ApiRouterOptions) {
  const router = createRouter();

  router.get('/', systemController.getApiIndex);
  router.use(systemRouter);
  router.use('/auth', createAuthRouter(options.authRateLimit));
  router.use('/users', userRouter);
  router.use('/products', productRouter);
  router.use('/settings', settingsRouter);
  router.use('/notifications', notificationRouter);
  router.use('/collections', collectionRouter);
  router.use('/saved-requests', savedRequestRouter);
  router.use('/history', historyRouter);
  router.use('/environments', environmentRouter);
  router.use(
    '/requests',
    createRequestRouter({
      rateLimit: options.executorRateLimit,
      ...(options.executorPolicy ? { policy: options.executorPolicy } : {}),
    }),
  );
  router.use('/dashboard', dashboardRouter);
  router.use('/docs', docsRouter);

  return router;
}
