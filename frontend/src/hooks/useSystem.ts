import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '@/services/api-client';
import { systemService } from '@/services/system.service';

export const systemKeys = {
  health: ['system', 'health'] as const,
  status: ['system', 'status'] as const,
};

export type ConnectionState = 'checking' | 'online' | 'degraded' | 'offline';

/** Polls /api/health and condenses it into one connection state for the header. */
export function useConnectionStatus() {
  const query = useQuery({
    queryKey: systemKeys.health,
    queryFn: async ({ signal }) => {
      const started = performance.now();
      const report = await systemService.getHealth(signal);
      return { report, roundTripMs: performance.now() - started };
    },
    refetchInterval: 15_000,
    retry: false,
  });

  let state: ConnectionState = 'checking';
  if (query.isError) {
    state = query.error instanceof ApiError && query.error.status === 503 ? 'degraded' : 'offline';
  } else if (query.data) {
    state = query.data.report.status === 'ok' ? 'online' : 'degraded';
  }

  /** Browser ⇄ API round trip of the last successful check. */
  const roundTripMs = query.isError ? null : (query.data?.roundTripMs ?? null);
  return { state, roundTripMs };
}

/** Full system report for the status page, refreshed every 10 s while `autoRefresh` is on. */
export function useSystemStatus(autoRefresh: boolean) {
  return useQuery({
    queryKey: systemKeys.status,
    queryFn: ({ signal }) => systemService.getStatus(signal),
    refetchInterval: autoRefresh ? 10_000 : false,
    placeholderData: keepPreviousData,
  });
}
