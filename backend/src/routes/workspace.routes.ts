import { createExecuteHandler, dashboardStats, openApiDocument } from '../controllers/tester.controller.js';
import * as workspace from '../controllers/workspace.controller.js';
import { authenticate } from '../middleware/auth.js';
import { createRateLimiter, type RateLimitConfig } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import {
  collectionBody,
  collectionPatch,
  dashboardQuery,
  environmentBody,
  executeBody,
  historyListQuery,
  savedRequestBody,
  savedRequestListQuery,
} from '../models/workspace.model.js';
import type { ExecutorPolicy } from '../services/executor.service.js';
import { stringIdParams } from '../utils/pagination.js';
import { createRouter } from '../utils/router.js';

const byId = validate({ params: stringIdParams });

// ─── /api/collections ───────────────────────────────────────────────────────
export const collectionRouter = createRouter();
collectionRouter.use(authenticate);
collectionRouter.get('/', workspace.listCollections);
collectionRouter.post('/', validate({ body: collectionBody }), workspace.createCollection);
collectionRouter.get('/:id', byId, workspace.getCollection);
collectionRouter.patch('/:id', validate({ params: stringIdParams, body: collectionPatch }), workspace.updateCollection);
collectionRouter.delete('/:id', byId, workspace.deleteCollection);

// ─── /api/saved-requests ────────────────────────────────────────────────────
export const savedRequestRouter = createRouter();
savedRequestRouter.use(authenticate);
savedRequestRouter.get('/', validate({ query: savedRequestListQuery }), workspace.listSavedRequests);
savedRequestRouter.post('/', validate({ body: savedRequestBody }), workspace.createSavedRequest);
savedRequestRouter.get('/:id', byId, workspace.getSavedRequest);
savedRequestRouter.put(
  '/:id',
  validate({ params: stringIdParams, body: savedRequestBody }),
  workspace.replaceSavedRequest,
);
savedRequestRouter.delete('/:id', byId, workspace.deleteSavedRequest);

// ─── /api/history ───────────────────────────────────────────────────────────
export const historyRouter = createRouter();
historyRouter.use(authenticate);
historyRouter.get('/', validate({ query: historyListQuery }), workspace.listHistory);
historyRouter.delete('/', workspace.clearHistory);
historyRouter.get('/:id', byId, workspace.getHistoryEntry);
historyRouter.delete('/:id', byId, workspace.deleteHistoryEntry);

// ─── /api/environments ──────────────────────────────────────────────────────
export const environmentRouter = createRouter();
environmentRouter.use(authenticate);
environmentRouter.get('/', workspace.listEnvironments);
environmentRouter.post('/', validate({ body: environmentBody }), workspace.createEnvironment);
environmentRouter.post('/deactivate', workspace.deactivateEnvironments);
environmentRouter.put(
  '/:id',
  validate({ params: stringIdParams, body: environmentBody }),
  workspace.replaceEnvironment,
);
environmentRouter.delete('/:id', byId, workspace.deleteEnvironment);
environmentRouter.post('/:id/activate', byId, workspace.activateEnvironment);

// ─── /api/requests ──────────────────────────────────────────────────────────
export function createRequestRouter(options: { rateLimit: RateLimitConfig; policy?: ExecutorPolicy }) {
  const router = createRouter();
  const perUser = createRateLimiter(options.rateLimit, {
    perUser: true,
    message: 'You are sending requests too quickly — wait a moment and try again',
  });
  router.post('/execute', authenticate, perUser, validate({ body: executeBody }), createExecuteHandler(options.policy));
  return router;
}

// ─── /api/dashboard and /api/docs ───────────────────────────────────────────
export const dashboardRouter = createRouter();
dashboardRouter.get('/stats', authenticate, validate({ query: dashboardQuery }), dashboardStats);

export const docsRouter = createRouter();
docsRouter.get('/', openApiDocument);
