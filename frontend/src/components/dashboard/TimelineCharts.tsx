import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { formatMs, formatNumber } from '@/lib/format';
import type { DashboardStats } from '@/types/models';
import { bucketTick, bucketTitle, columnPath } from './chart-utils';

type Row = DashboardStats['timeline'][number] & { tick: string; latency: number | null };

const AXIS_TICK = { fill: 'var(--ink-faint)', fontSize: 11 };
const BAR_MAX = 24;
const GAP = 2;

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Row;
}

/** Successful requests: the lower segment. Its top is the data end only when nothing failed. */
function SuccessSegment({ x = 0, y = 0, width = 0, height = 0, payload }: SegmentProps) {
  const stacked = (payload?.failed ?? 0) > 0;
  const path = stacked ? columnPath(x, y + GAP, width, height - GAP, 0) : columnPath(x, y, width, height, 4);
  return path ? <path d={path} style={{ fill: 'var(--chart-ok)' }} /> : null;
}

function FailSegment({ x = 0, y = 0, width = 0, height = 0 }: SegmentProps) {
  const path = columnPath(x, y, width, height, 4);
  return path ? <path d={path} style={{ fill: 'var(--chart-fail)' }} /> : null;
}

function LineKey({ color }: { color: string }) {
  return <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />;
}

function TooltipCard({ title, rows }: { title: string; rows: Array<{ color: string; label: string; value: string }> }) {
  return (
    <div className="min-w-44 rounded-xl border border-line-strong bg-surface-strong px-3 py-2.5 shadow-lg backdrop-blur-xl">
      <p className="mb-1.5 text-xs text-ink-faint">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2 text-[0.8125rem]">
          <LineKey color={row.color} />
          <span className="font-semibold text-ink tabular-nums">{row.value}</span>
          <span className="text-ink-muted">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-ink-muted" aria-label="Legend">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function TimelineTable({ rows, unit }: { rows: Row[]; unit: DashboardStats['bucket'] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-xl border border-line">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">Requests per {unit}</caption>
        <thead className="sticky top-0 bg-surface-strong text-left text-xs text-ink-faint backdrop-blur-xl">
          <tr>
            <th className="px-3 py-2 font-normal">{unit === 'hour' ? 'Hour' : 'Day'}</th>
            <th className="px-3 py-2 text-right font-normal">Requests</th>
            <th className="px-3 py-2 text-right font-normal">Successful</th>
            <th className="px-3 py-2 text-right font-normal">Failed</th>
            <th className="px-3 py-2 text-right font-normal">Average response</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map((row) => (
            <tr key={row.bucket}>
              <td className="px-3 py-1.5 text-ink-muted">{bucketTitle(row.bucket, unit)}</td>
              <td className="px-3 py-1.5 text-right">{formatNumber(row.total)}</td>
              <td className="px-3 py-1.5 text-right">{formatNumber(row.successful)}</td>
              <td className="px-3 py-1.5 text-right">{formatNumber(row.failed)}</td>
              <td className="px-3 py-1.5 text-right">{row.latency === null ? '—' : formatMs(row.latency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TimelineChartsProps {
  stats: DashboardStats;
  animate: boolean;
}

/**
 * Requests over time (stacked successful/failed columns) and average response
 * time (its own chart — two measures never share one plot with two scales).
 */
export function TimelineCharts({ stats, animate }: TimelineChartsProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const rows: Row[] = stats.timeline.map((entry) => ({
    ...entry,
    tick: bucketTick(entry.bucket, stats.bucket),
    // An empty bucket has no response time, not a response time of zero.
    latency: entry.total > 0 ? entry.averageResponseTimeMs : null,
  }));
  const unitLabel = stats.bucket === 'hour' ? 'hour' : 'day';

  return (
    <Panel aria-labelledby="timeline-title">
      <PanelHeader
        id="timeline-title"
        title="Requests over time"
        description={`Per ${unitLabel}, split by outcome.`}
        actions={
          <SegmentedControl
            label="Show requests over time as"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart' },
              { value: 'table', label: 'Table' },
            ]}
          />
        }
      />

      {view === 'table' ? (
        <TimelineTable rows={rows} unit={stats.bucket} />
      ) : (
        <>
          <Legend
            items={[
              { color: 'var(--chart-ok)', label: 'Successful (2xx–3xx)' },
              { color: 'var(--chart-fail)', label: 'Failed (4xx, 5xx, no answer)' },
            ]}
          />
          <div
            className="mt-3 h-60"
            role="img"
            aria-label={`Column chart of requests per ${unitLabel}. Switch to Table for the values.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: -14 }} barCategoryGap="24%">
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="tick"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--line-strong)' }}
                  tick={AXIS_TICK}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} />
                <Tooltip
                  cursor={{ fill: 'var(--line)' }}
                  content={({ active, payload }) => {
                    const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                    if (!row) return null;
                    return (
                      <TooltipCard
                        title={bucketTitle(row.bucket, stats.bucket)}
                        rows={[
                          { color: 'var(--chart-ok)', label: 'successful', value: formatNumber(row.successful) },
                          { color: 'var(--chart-fail)', label: 'failed', value: formatNumber(row.failed) },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="successful"
                  stackId="outcome"
                  maxBarSize={BAR_MAX}
                  shape={(props: SegmentProps) => <SuccessSegment {...props} />}
                  isAnimationActive={animate}
                />
                <Bar
                  dataKey="failed"
                  stackId="outcome"
                  maxBarSize={BAR_MAX}
                  shape={(props: SegmentProps) => <FailSegment {...props} />}
                  isAnimationActive={animate}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-8 text-[0.8125rem] font-medium text-ink">
            Average response time <span className="font-normal text-ink-faint">(milliseconds)</span>
          </h3>
          <div
            className="mt-3 h-36"
            role="img"
            aria-label={`Area chart of average response time per ${unitLabel}. Switch to Table for the values.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: -14 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="tick"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--line-strong)' }}
                  tick={AXIS_TICK}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  width={44}
                  allowDecimals={false}
                  tickFormatter={(value: number) => formatNumber(Math.round(value))}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                    if (!row) return null;
                    return (
                      <TooltipCard
                        title={bucketTitle(row.bucket, stats.bucket)}
                        rows={[
                          {
                            color: 'var(--chart-series)',
                            label: 'average',
                            value: row.latency === null ? 'no requests' : formatMs(row.latency),
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="var(--chart-series)"
                  strokeWidth={2}
                  fill="var(--chart-series)"
                  fillOpacity={0.1}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4, stroke: 'var(--canvas)', strokeWidth: 2, fill: 'var(--chart-series)' }}
                  isAnimationActive={animate}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}
