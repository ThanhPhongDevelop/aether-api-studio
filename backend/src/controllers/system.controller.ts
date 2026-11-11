import type { Request, Response } from 'express';
import * as systemService from '../services/system.service.js';
import { AppError } from '../utils/app-error.js';
import { sendSuccess } from '../utils/http-response.js';

export function getApiIndex(_req: Request, res: Response): void {
  sendSuccess(res, systemService.getApiIndex());
}

/** 200 when healthy, 503 when a critical dependency is down (for load balancers / uptime monitors). */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const report = await systemService.getHealthReport();
  res.setHeader('Cache-Control', 'no-store');
  if (report.status === 'down') {
    throw AppError.serviceUnavailable('A critical dependency is unavailable', report);
  }
  sendSuccess(res, report);
}

/** Always 200 so dashboards can render details even when the system is degraded or down. */
export async function getStatus(_req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, await systemService.getStatusReport());
}
