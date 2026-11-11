import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { testerService } from '@/services/workspace.service';
import type { DashboardRange, DashboardScope } from '@/types/models';
import { useAuth } from './useAuth';
import { workspaceKeys } from './useWorkspace';

/** Usage statistics, refreshed every 30 seconds; the previous result stays on screen while reloading. */
export function useDashboardStats(scope: DashboardScope, range: DashboardRange) {
  const { status } = useAuth();
  // Minutes east of UTC, so the server can bucket by the viewer's own hours and days.
  const tzOffset = -new Date().getTimezoneOffset();
  return useQuery({
    queryKey: [...workspaceKeys.dashboard, scope, range, tzOffset],
    queryFn: ({ signal }) => testerService.dashboard({ scope, range, tzOffset }, signal),
    enabled: status === 'authenticated',
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}
