import type { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

interface SendOptions {
  status?: number;
  meta?: Record<string, unknown>;
}

/** Send the standard success envelope: `{ success: true, data, meta? }`. */
export function sendSuccess<T>(res: Response, data: T, options: SendOptions = {}): void {
  const body: ApiSuccess<T> = { success: true, data, ...(options.meta ? { meta: options.meta } : {}) };
  res.status(options.status ?? 200).json(body);
}
