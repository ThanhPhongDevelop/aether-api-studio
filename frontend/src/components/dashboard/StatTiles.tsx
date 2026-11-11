import { formatMs, formatNumber, formatPercent } from '@/lib/format';
import type { DashboardStats } from '@/types/models';

/** The headline numbers in one strip; values use the UI sans with proportional figures. */
export function StatTiles({ totals }: { totals: DashboardStats['totals'] }) {
  const tiles = [
    { label: 'Requests', value: formatNumber(totals.totalRequests), note: 'Sent in this period' },
    { label: 'Successful', value: formatNumber(totals.successfulRequests), note: 'Answered 2xx or 3xx' },
    { label: 'Failed', value: formatNumber(totals.failedRequests), note: '4xx, 5xx or no answer' },
    {
      label: 'Success rate',
      value: totals.totalRequests ? formatPercent(totals.successRate) : '—',
      note: 'Of all requests',
    },
    {
      label: 'Average response',
      value: totals.totalRequests ? formatMs(totals.averageResponseTimeMs) : '—',
      note: 'Until the full body arrived',
    },
  ];

  return (
    <dl className="glass grid grid-cols-2 gap-x-6 gap-y-6 rounded-[1.25rem] p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="lg:border-l lg:border-line lg:pl-6 lg:first:border-l-0 lg:first:pl-0">
          <dt className="text-[0.8125rem] text-ink-muted">{tile.label}</dt>
          <dd className="mt-1.5 text-[1.75rem] leading-none font-semibold tracking-tight text-ink">{tile.value}</dd>
          <dd className="mt-2 text-xs text-ink-faint">{tile.note}</dd>
        </div>
      ))}
    </dl>
  );
}
