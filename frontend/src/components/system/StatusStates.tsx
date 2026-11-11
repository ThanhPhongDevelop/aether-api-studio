import { RefreshCw, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/services/api-client';

export function StatusSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading system status">
      <div className="glass grid gap-px overflow-hidden rounded-[1.25rem] sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-4 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-[1.25rem]" />
        <Skeleton className="h-56 rounded-[1.25rem]" />
      </div>
    </div>
  );
}

/** Shown when the very first status request fails — explains the cause and the fix. */
export function StatusUnavailable({
  error,
  onRetry,
  retrying,
}: {
  error: Error;
  onRetry: () => void;
  retrying: boolean;
}) {
  const unreachable = !(error instanceof ApiError) || error.isUnreachable;

  return (
    <Panel className="py-12 text-center">
      <Unplug className="mx-auto size-8 text-fail" aria-hidden />
      <h2 className="mt-4 font-display text-xl font-normal">
        {unreachable ? 'Can’t reach the API server' : 'The API returned an error'}
      </h2>
      {unreachable ? (
        <p className="mx-auto mt-2 max-w-[54ch] text-ink-muted">
          This page reads live data from the backend on port 4000. Start both servers from the project root with{' '}
          <code className="font-mono text-ink">npm run dev</code>, then retry.
        </p>
      ) : (
        <p className="mx-auto mt-2 max-w-[54ch] text-ink-muted">
          {error.message}
          {error instanceof ApiError && error.requestId ? (
            <>
              {' '}
              Request id <code className="font-mono text-ink">{error.requestId}</code>.
            </>
          ) : null}
        </p>
      )}
      <Button className="mt-6" onClick={onRetry} loading={retrying} icon={<RefreshCw />}>
        Retry now
      </Button>
    </Panel>
  );
}
