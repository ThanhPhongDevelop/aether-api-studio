import { Pause, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { StatusReadouts } from '@/components/system/StatusReadouts';
import { StatusSkeleton, StatusUnavailable } from '@/components/system/StatusStates';
import { RecordsPanel, StatusCodesPanel, TopRoutesPanel } from '@/components/system/TrafficPanels';
import { Button } from '@/components/ui/Button';
import { pageTitle } from '@/config/app';
import { useSystemStatus } from '@/hooks/useSystem';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { TONE_CLASSES, type Tone } from '@/lib/http';
import type { OverallStatus } from '@/types/system';

const OVERALL: Record<OverallStatus | 'unreachable', { label: string; tone: Tone }> = {
  ok: { label: 'All systems operational', tone: 'ok' },
  degraded: { label: 'Degraded performance', tone: 'warn' },
  down: { label: 'Database unavailable', tone: 'fail' },
  unreachable: { label: 'API unreachable', tone: 'fail' },
};

export default function SystemStatusPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useSystemStatus(autoRefresh);

  const overall = error && !data ? OVERALL.unreachable : data ? OVERALL[data.status] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pt-8">
      <title>{pageTitle('System status')}</title>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-normal tracking-tight sm:text-3xl">System status</h1>
          {overall ? (
            <p className="flex items-center gap-2.5 text-[1.0625rem] text-ink">
              <span
                className={cn('size-2.5 rounded-full', TONE_CLASSES[overall.tone].dot, TONE_CLASSES[overall.tone].glow)}
                aria-hidden
              />
              {overall.label}
            </p>
          ) : (
            <p className="text-ink-muted">Checking the API…</p>
          )}
          <p className="text-[0.8125rem] text-ink-faint">
            {dataUpdatedAt ? `Updated at ${formatClock(dataUpdatedAt)}` : 'Waiting for the first report'}
            {autoRefresh ? ', refreshing every 10 seconds' : ', auto-refresh paused'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={autoRefresh ? <Pause /> : <Play />}
            aria-pressed={!autoRefresh}
            onClick={() => setAutoRefresh((value) => !value)}
          >
            {autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn(isFetching && 'animate-spin')} />}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Refresh
          </Button>
        </div>
      </header>

      {data && error ? (
        <p role="alert" className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          The last refresh failed ({error.message}). Showing the report from {formatClock(dataUpdatedAt)}.
        </p>
      ) : null}

      {data ? (
        <>
          <StatusReadouts report={data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <StatusCodesPanel traffic={data.traffic} />
            <TopRoutesPanel traffic={data.traffic} />
          </div>
          <RecordsPanel records={data.database.records} />
        </>
      ) : error ? (
        <StatusUnavailable error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : isPending ? (
        <StatusSkeleton />
      ) : null}
    </div>
  );
}
