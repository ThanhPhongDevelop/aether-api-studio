import type { HealthReport, StatusReport } from '@/types/system';
import { api } from './api-client';

export const systemService = {
  getHealth: (signal?: AbortSignal) => api.get<HealthReport>('/health', { signal }),
  getStatus: (signal?: AbortSignal) => api.get<StatusReport>('/status', { signal }),
};
