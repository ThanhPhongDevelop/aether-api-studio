import type {
  Collection,
  DashboardRange,
  DashboardScope,
  DashboardStats,
  Environment,
  EnvironmentInput,
  ExecuteInput,
  ExecuteResult,
  HistoryDetail,
  HistorySummary,
  SavedRequest,
  SavedRequestInput,
} from '@/types/models';
import type { OpenApiDocument } from '@/types/openapi';
import { api, withQuery } from './api-client';

export const collectionService = {
  list: (signal?: AbortSignal) => api.get<Collection[]>('/collections', { signal }),
  create: (input: { name: string; description?: string | null }) => api.post<Collection>('/collections', input),
  update: (id: string, input: { name?: string; description?: string | null }) =>
    api.patch<Collection>(`/collections/${id}`, input),
  remove: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/collections/${id}`),
};

export const savedRequestService = {
  create: (input: SavedRequestInput) => api.post<SavedRequest>('/saved-requests', input),
  replace: (id: string, input: SavedRequestInput) => api.put<SavedRequest>(`/saved-requests/${id}`, input),
  remove: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/saved-requests/${id}`),
};

export const environmentService = {
  list: (signal?: AbortSignal) => api.get<Environment[]>('/environments', { signal }),
  create: (input: EnvironmentInput) => api.post<Environment>('/environments', input),
  replace: (id: string, input: EnvironmentInput) => api.put<Environment>(`/environments/${id}`, input),
  remove: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/environments/${id}`),
  activate: (id: string) => api.post<Environment>(`/environments/${id}/activate`),
  deactivate: () => api.post<{ active: null }>('/environments/deactivate'),
};

export interface HistoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  method?: string;
  status?: 'success' | 'error' | '2xx' | '3xx' | '4xx' | '5xx';
}

export const historyService = {
  list: (query: HistoryQuery, signal?: AbortSignal) =>
    api.list<HistorySummary>(withQuery('/history', { ...query }), { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<HistoryDetail>(`/history/${id}`, { signal }),
  remove: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/history/${id}`),
  clear: () => api.delete<{ deleted: number }>('/history'),
};

export const testerService = {
  /** Runs the request on the server (no browser CORS limits) and reports what came back. */
  execute: (input: ExecuteInput, signal?: AbortSignal) =>
    api.post<ExecuteResult>('/requests/execute', input, {
      signal,
      // Leave room for the target's own timeout plus the proxy round trip.
      timeoutMs: (input.timeoutMs ?? 30_000) + 10_000,
    }),
  dashboard: (query: { scope: DashboardScope; range: DashboardRange; tzOffset: number }, signal?: AbortSignal) =>
    api.get<DashboardStats>(withQuery('/dashboard/stats', { ...query }), { signal }),
  docs: (signal?: AbortSignal) => api.document<OpenApiDocument>('/docs', { signal }),
};
