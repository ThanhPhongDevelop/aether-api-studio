import { History } from 'lucide-react';
import type { ReactNode } from 'react';
import { MethodBadge, ToneBadge } from '@/components/ui/Badges';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { cn } from '@/lib/cn';
import { formatMs, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { STATUS_TEXT, toneForStatus } from '@/lib/http';
import type { DashboardStats } from '@/types/models';
import { STATUS_CLASS_LABEL, statusChartColor } from './chart-utils';

interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  color: string;
}

/** Ranked horizontal bars on one baseline, value at the tip. */
function RankedBars({ rows, total, label }: { rows: BarRow[]; total: number; label: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="space-y-3" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-3">
          <span className="min-w-0 truncate text-[0.8125rem] text-ink-muted">{row.label}</span>
          <span className="flex items-center gap-2.5">
            <span className="h-3 min-w-0 flex-1">
              <span
                className="block h-full rounded-r-[4px]"
                style={{ width: `${Math.max(1.5, (row.value / max) * 100)}%`, background: row.color }}
              />
            </span>
            <span className="w-24 shrink-0 text-right text-[0.8125rem] text-ink tabular-nums">
              {formatNumber(row.value)}
              <span className="ml-1.5 text-xs text-ink-faint">
                {formatPercent((row.value / Math.max(1, total)) * 100)}
              </span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StatusBreakdown({ stats }: { stats: DashboardStats }) {
  const rows = [...stats.statusCodes]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((entry) => {
      const code = Number(entry.statusCode);
      const name =
        entry.statusCode === 'ERR'
          ? 'No response'
          : (STATUS_TEXT[code] ?? STATUS_CLASS_LABEL[entry.statusCode[0] ?? ''] ?? 'Other');
      return {
        key: entry.statusCode,
        label: (
          <>
            <span className="font-mono text-ink">{entry.statusCode}</span> {name}
          </>
        ),
        value: entry.count,
        color: statusChartColor(entry.statusCode),
      };
    });

  return (
    <Panel aria-labelledby="status-title">
      <PanelHeader id="status-title" title="Status codes" description="Largest first, coloured by outcome." />
      {rows.length ? (
        <RankedBars rows={rows} total={stats.totals.totalRequests} label="Requests by status code" />
      ) : (
        <p className="text-[0.8125rem] text-ink-faint">No responses in this period.</p>
      )}
    </Panel>
  );
}

export function MethodBreakdown({ stats }: { stats: DashboardStats }) {
  const rows = [...stats.methods]
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      key: entry.method,
      label: <MethodBadge method={entry.method} />,
      value: entry.count,
      color: 'var(--chart-series)',
    }));

  return (
    <Panel aria-labelledby="methods-title">
      <PanelHeader id="methods-title" title="Methods" description="How the requests were sent." />
      {rows.length ? (
        <RankedBars rows={rows} total={stats.totals.totalRequests} label="Requests by method" />
      ) : (
        <p className="text-[0.8125rem] text-ink-faint">No requests in this period.</p>
      )}
    </Panel>
  );
}

export function TopEndpoints({ stats }: { stats: DashboardStats }) {
  return (
    <Panel aria-labelledby="endpoints-title" className="overflow-hidden">
      <PanelHeader id="endpoints-title" title="Busiest endpoints" description="Ranked by number of requests." />
      {stats.topEndpoints.length ? (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[32rem] table-fixed text-[0.8125rem]">
            <caption className="sr-only">Busiest endpoints</caption>
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-28" />
            </colgroup>
            <thead className="text-left text-xs text-ink-faint">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-normal sm:px-6">Endpoint</th>
                <th className="px-3 py-2 text-right font-normal">Requests</th>
                <th className="px-3 py-2 text-right font-normal">Failed</th>
                <th className="px-5 py-2 text-right font-normal sm:px-6">Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {stats.topEndpoints.map((entry) => (
                <tr key={`${entry.method} ${entry.endpoint}`}>
                  <td className="px-5 py-2.5 sm:px-6">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <MethodBadge method={entry.method} />
                      <span className="truncate font-mono text-xs text-ink" title={entry.endpoint}>
                        {entry.endpoint}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(entry.count)}</td>
                  <td className={cn('px-3 py-2.5 text-right', entry.failed > 0 ? 'text-fail' : 'text-ink-faint')}>
                    {formatNumber(entry.failed)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-ink-muted sm:px-6">
                    {formatMs(entry.averageResponseTimeMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[0.8125rem] text-ink-faint">No requests in this period.</p>
      )}
    </Panel>
  );
}

interface RecentActivityProps {
  stats: DashboardStats;
  /** Re-open an entry in the API Tester (only for your own history). */
  onOpen?: (id: string) => void;
}

export function RecentActivity({ stats, onOpen }: RecentActivityProps) {
  return (
    <Panel aria-labelledby="activity-title">
      <PanelHeader
        id="activity-title"
        title="Recent activity"
        description={onOpen ? 'Select a request to open it in the tester.' : 'Latest requests handled by the server.'}
      />
      {stats.recentActivity.length ? (
        <ul className="-mx-2 space-y-0.5">
          {stats.recentActivity.map((entry) => {
            const content = (
              <>
                <MethodBadge method={entry.method} />
                <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-ink" title={entry.target}>
                  {entry.target}
                </span>
                <ToneBadge tone={entry.statusCode === null ? 'fail' : toneForStatus(entry.statusCode)}>
                  {entry.statusCode ?? 'ERR'}
                </ToneBadge>
                <span className="hidden w-16 text-right text-xs text-ink-muted tabular-nums sm:block">
                  {formatMs(entry.durationMs)}
                </span>
                <span className="w-24 text-right text-xs text-ink-faint">{formatRelative(entry.createdAt)}</span>
              </>
            );
            return (
              <li key={entry.id}>
                {onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(entry.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-line/60"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={History} title="Nothing yet" description="Requests you send appear here." compact />
      )}
    </Panel>
  );
}
