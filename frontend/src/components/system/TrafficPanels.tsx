import { MethodBadge } from '@/components/ui/Badges';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { cn } from '@/lib/cn';
import { formatMs, formatNumber } from '@/lib/format';
import { STATUS_TEXT, TONE_CLASSES, toneForStatus } from '@/lib/http';
import type { RecordCounts, TrafficStats } from '@/types/system';

const EMPTY_TRAFFIC = 'No API traffic recorded yet. Requests to /api appear here a few seconds after they finish.';

export function StatusCodesPanel({ traffic }: { traffic: TrafficStats | null }) {
  const codes = traffic?.statusCodes ?? [];
  const max = Math.max(1, ...codes.map((entry) => entry.count));

  return (
    <Panel aria-labelledby="status-codes">
      <PanelHeader
        id="status-codes"
        title="Responses by status code"
        description="Last 24 hours, health probes excluded"
      />
      {codes.length === 0 ? (
        <p className="text-sm text-ink-faint">{EMPTY_TRAFFIC}</p>
      ) : (
        <ul className="space-y-3.5">
          {codes.map(({ statusCode, count }) => {
            const tone = toneForStatus(statusCode);
            return (
              <li key={statusCode} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3">
                <span className={cn('font-mono text-sm font-medium', TONE_CLASSES[tone].text)}>{statusCode}</span>
                <div className="min-w-0">
                  <p className="mb-1 truncate text-xs text-ink-muted">{STATUS_TEXT[statusCode] ?? 'Other'}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className={cn('h-full rounded-full', TONE_CLASSES[tone].dot)}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-ink tabular-nums">{formatNumber(count)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function TopRoutesPanel({ traffic }: { traffic: TrafficStats | null }) {
  const routes = traffic?.topRoutes ?? [];

  return (
    <Panel aria-labelledby="top-routes">
      <PanelHeader id="top-routes" title="Busiest routes" description="Matched route patterns, last 24 hours" />
      {routes.length === 0 ? (
        <p className="text-sm text-ink-faint">{EMPTY_TRAFFIC}</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th scope="col" className="px-2 pb-2 font-normal">
                  Route
                </th>
                <th scope="col" className="px-2 pb-2 text-right font-normal">
                  Requests
                </th>
                <th scope="col" className="px-2 pb-2 text-right font-normal">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={`${route.method} ${route.route}`} className="border-t border-line">
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <MethodBadge method={route.method} />
                      <code className="truncate font-mono text-[0.8125rem] text-ink">{route.route}</code>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-ink tabular-nums">{formatNumber(route.count)}</td>
                  <td className="px-2 py-2.5 text-right text-ink-muted tabular-nums">
                    {formatMs(route.averageResponseTimeMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const RECORD_LABELS: Record<keyof RecordCounts, string> = {
  users: 'Users',
  products: 'Products',
  collections: 'Collections',
  savedRequests: 'Saved requests',
  environments: 'Environments',
  requestHistory: 'History entries',
};

export function RecordsPanel({ records }: { records: RecordCounts | null }) {
  return (
    <Panel aria-labelledby="stored-records">
      <PanelHeader id="stored-records" title="Stored records" description="Live row counts from the database" />
      {records ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {(Object.keys(RECORD_LABELS) as (keyof RecordCounts)[]).map((key) => (
            <div key={key}>
              <dt className="text-xs text-ink-muted">{RECORD_LABELS[key]}</dt>
              <dd className="mt-1 font-display text-xl text-ink tabular-nums">{formatNumber(records[key])}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-ink-faint">Counts are unavailable while the database is down.</p>
      )}
    </Panel>
  );
}
