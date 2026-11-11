import { History, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MethodBadge, ToneBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useToast } from '@/hooks/useToast';
import { useHistory, useHistoryMutations } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/form-errors';
import { formatMs, formatRelative } from '@/lib/format';
import { toneForStatus } from '@/lib/http';
import { hostAndPath } from '@/lib/tester-store';
import type { HistoryQuery } from '@/services/workspace.service';
import type { HistorySummary } from '@/types/models';

const PAGE = 25;
const MAX = 100;

export function HistoryPanel({ onOpen }: { onOpen: (entry: HistorySummary) => void }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<HistoryQuery['status'] | ''>('');
  const [limit, setLimit] = useState(PAGE);
  const debounced = useDebouncedValue(search.trim(), 300);
  const history = useHistory({ page: 1, limit, search: debounced || undefined, status: status || undefined });
  const { remove, clear } = useHistoryMutations();
  const confirm = useConfirm();
  const toast = useToast();

  const clearAll = async () => {
    const confirmed = await confirm({
      title: 'Clear your request history?',
      description:
        'Every recorded request and response is deleted and your dashboard starts again from zero. Saved requests stay.',
      confirmLabel: 'Clear history',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const { deleted } = await clear.mutateAsync();
      toast.success('History cleared', `${deleted} request${deleted === 1 ? '' : 's'} removed.`);
    } catch (error) {
      toast.error('History not cleared', errorMessage(error));
    }
  };

  const items = history.data?.items ?? [];
  const total = history.data?.meta.total ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search URLs"
          label="Search history"
          inputSize="sm"
          className="min-w-0 flex-1"
        />
        <Select
          selectSize="sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as HistoryQuery['status'] | '')}
          aria-label="Filter by outcome"
          className="w-28 shrink-0"
        >
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="error">Errors</option>
          <option value="4xx">4xx</option>
          <option value="5xx">5xx</option>
        </Select>
      </div>

      <div
        className={cn(
          '-mx-1 min-h-0 flex-1 overflow-y-auto px-1 transition-opacity',
          history.isPlaceholderData && 'opacity-60',
        )}
      >
        {history.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : history.isError ? (
          <ErrorState message={errorMessage(history.error)} onRetry={() => void history.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            compact
            title={debounced || status ? 'Nothing matches' : 'No requests yet'}
            description={
              debounced || status ? 'Change the search or the filter.' : 'Every request you send is recorded here.'
            }
          />
        ) : (
          <ul className="space-y-px">
            {items.map((entry) => (
              <li key={entry.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpen(entry)}
                  className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2 py-2 text-left transition-colors hover:bg-line/60"
                >
                  <span className="flex w-full items-center gap-2">
                    <MethodBadge method={entry.method} className="min-w-[3.1rem] text-[0.625rem]" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={entry.url}>
                      {hostAndPath(entry.url)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 pl-0.5 text-[0.6875rem] text-ink-faint">
                    <ToneBadge
                      tone={entry.statusCode === null ? 'fail' : toneForStatus(entry.statusCode)}
                      className="px-1.5 py-0 text-[0.625rem]"
                    >
                      {entry.statusCode ?? 'ERR'}
                    </ToneBadge>
                    <span className="tabular-nums">{formatMs(entry.durationMs)}</span>
                    <span className="ml-auto">{formatRelative(entry.createdAt)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate(entry.id, {
                      onError: (error) => toast.error('Entry not deleted', errorMessage(error)),
                    })
                  }
                  aria-label={`Delete history entry ${entry.method} ${entry.url}`}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-fail/10 hover:text-fail group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.length < total && limit < MAX ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setLimit((value) => Math.min(MAX, value + PAGE))}
          >
            Show more ({total - items.length} older)
          </Button>
        ) : items.length > 0 && items.length < total ? (
          <p className="mt-2 px-2 text-xs text-ink-faint">Showing the latest {MAX}. Search to find older requests.</p>
        ) : null}
      </div>

      {total > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 />}
          onClick={() => void clearAll()}
          className="text-fail hover:bg-fail/10 hover:text-fail"
        >
          Clear history
        </Button>
      ) : null}
    </div>
  );
}
