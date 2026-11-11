import type { Request, Response } from 'express';
import { buildOpenApiDocument } from '../docs/openapi.js';
import type { DashboardQuery, ExecuteInput } from '../models/workspace.model.js';
import { getDashboardStats } from '../services/dashboard.service.js';
import { executeRequest, type ExecutorPolicy } from '../services/executor.service.js';
import { APP_VERSION } from '../services/system.service.js';
import { AppError } from '../utils/app-error.js';
import { sendSuccess } from '../utils/http-response.js';
import { requireUser, validated } from '../utils/request.js';

export function createExecuteHandler(policy?: ExecutorPolicy) {
  return async (req: Request, res: Response) => {
    const result = await executeRequest(validated<ExecuteInput>(res, 'body'), {
      userId: requireUser(req).id,
      ...(policy ? { policy } : {}),
    });
    sendSuccess(res, result);
  };
}

export async function dashboardStats(req: Request, res: Response) {
  const user = requireUser(req);
  const query = validated<DashboardQuery>(res, 'query');
  if (query.scope === 'server' && user.role !== 'ADMIN') {
    throw AppError.forbidden('Server-wide statistics are available to administrators only');
  }
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, await getDashboardStats(query, user.id));
}

/** Raw OpenAPI document (no envelope) so standard tools can import it. */
export function openApiDocument(_req: Request, res: Response) {
  res.json(buildOpenApiDocument(APP_VERSION));
}
