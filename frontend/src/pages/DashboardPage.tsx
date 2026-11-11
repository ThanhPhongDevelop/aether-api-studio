import { RefreshCw, Send } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MethodBreakdown, RecentActivity, StatusBreakdown, TopEndpoints } from '@/components/dashboard/Breakdowns';
import { StatTiles } from '@/components/dashboard/StatTiles';
import { TimelineCharts } from '@/components/dashboard/TimelineCharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats } from '@/hooks/useDashboard';
import { useEffectsPreference } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/form-errors';
import { formatClock } from '@/lib/format';
import { draftFromHistory, resultFromHistory, testerStore } from '@/lib/tester-store';
import { historyService } from '@/services/workspace.service';
import type { DashboardRange, DashboardScope } from '@/types/models';

const RANGES: Array<{ value: DashboardRange; label: string }> = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading statistics">
      <Skeleton className="h-28 rounded-[1.25rem]" />
      <Skeleton className="h-96 rounded-[1.25rem]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-[1.25rem]" />
        <Skeleton className="h-56 rounded-[1.25rem]" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { reducedMotion } = useEffectsPreference();
  const [range, setRange] = useState<DashboardRange>('24h');
  const [scope, setScope] = useState<DashboardScope>('me');
  const stats = useDashboardStats(scope, range);

  const openHistoryEntry = async (id: string) => {
    try {
      const entry = await historyService.get(id);
      const { draft, droppedCredentials } = draftFromHistory(entry);
      testerStore.load(draft, {
        response: { source: 'history', result: resultFromHistory(entry), receivedAt: entry.createdAt },
      });
      if (droppedCredentials)
        toast.info('Credentials were not stored', 'Add the Authorization header or token again before resending.');
      void navigate('/tester');
    } catch (error) {
      toast.error('Could not open that request', errorMessage(error));
    }
  };

  const data = stats.data;
  const empty = data !== undefined && data.totals.totalRequests === 0;

  return (
    <>
      <title>{pageTitle('Dashboard')}</title>
      <PageHeader
        title="Dashboard"
        description={
          scope === 'me'
            ? 'Your API Tester activity: what you sent, what came back and how fast.'
            : 'Every request the Aether API itself handled, from all clients.'
        }
      />

      {/* One filter row scopes every number below it. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SegmentedControl label="Time range" value={range} onChange={setRange} options={RANGES} />
        {isAdmin ? (
          <SegmentedControl
            label="Whose requests"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'me', label: 'My requests' },
              { value: 'server', label: 'All API traffic' },
            ]}
          />
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-xs text-ink-faint">
          {data ? `Updated ${formatClock(new Date(data.generatedAt))}` : null}
          <Button
            variant="ghost"
            size="sm"
            className="size-8 px-0"
            onClick={() => void stats.refetch()}
            aria-label="Refresh statistics"
            title="Refresh statistics"
          >
            <RefreshCw className={cn(stats.isFetching && 'animate-spin')} />
          </Button>
        </span>
      </div>

      {stats.isError && !data ? (
        <ErrorState
          message={errorMessage(stats.error, 'Statistics could not be loaded.')}
          onRetry={() => void stats.refetch()}
        />
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        // While a new range loads, the previous figures stay, dimmed, with no layout jump.
        <div className={cn('space-y-5 transition-opacity', stats.isPlaceholderData && 'opacity-60')}>
          <StatTiles totals={data.totals} />
          {empty ? (
            <EmptyState
              icon={Send}
              title={scope === 'me' ? 'No requests in this period' : 'No API traffic in this period'}
              description={
                scope === 'me'
                  ? 'Send a request from the API Tester and it will show up here within seconds.'
                  : 'Requests to the Aether API are recorded as they arrive.'
              }
              action={scope === 'me' ? <ButtonLink to="/tester">Open the API Tester</ButtonLink> : undefined}
              className="glass rounded-[1.25rem]"
            />
          ) : (
            <>
              <TimelineCharts stats={data} animate={!reducedMotion} />
              <div className="grid gap-5 lg:grid-cols-2">
                <StatusBreakdown stats={data} />
                <MethodBreakdown stats={data} />
              </div>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <TopEndpoints stats={data} />
                <RecentActivity stats={data} onOpen={scope === 'me' ? (id) => void openHistoryEntry(id) : undefined} />
              </div>
              {data.sampled ? (
                <p className="text-xs text-ink-faint">
                  Figures are based on the most recent requests in this period (large volumes are sampled).
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </>
  );
}
