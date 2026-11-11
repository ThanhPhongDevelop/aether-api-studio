import { Database, Gauge, MemoryStick, Server, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Meter } from '@/components/ui/Meter';
import { cn } from '@/lib/cn';
import { formatBytes, formatMs, formatNumber, formatPercent, formatUptime } from '@/lib/format';
import type { StatusReport } from '@/types/system';

interface ReadoutProps {
  icon: LucideIcon;
  label: string;
  value: string;
  valueClassName?: string;
  className?: string;
  children: ReactNode;
}

function Readout({ icon: Icon, label, value, valueClassName, className, children }: ReadoutProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 border-line p-5 sm:p-6', className)}>
      <p className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p
        className={cn(
          'font-display text-[1.75rem] leading-none font-[450] tracking-tight tabular-nums',
          valueClassName,
        )}
      >
        {value}
      </p>
      <div className="space-y-1.5 text-[0.8125rem] text-ink-muted">{children}</div>
    </div>
  );
}

/** Four instrument readouts in one panel, separated by hairlines. */
export function StatusReadouts({ report }: { report: StatusReport }) {
  const { service, runtime, database, traffic, metricsEnabled } = report;
  const databaseUp = database.status === 'up';

  return (
    <section
      aria-label="Key metrics"
      className="glass grid overflow-hidden rounded-[1.25rem] sm:grid-cols-2 xl:grid-cols-4"
    >
      <Readout
        icon={Server}
        label="API server"
        value={formatUptime(service.uptimeSeconds)}
        className="border-b sm:border-r xl:border-b-0"
      >
        <p>Uptime since {new Date(service.startedAt).toLocaleString()}</p>
        <p>
          Version {service.version}, {service.environment}, Node {runtime.node}
        </p>
      </Readout>

      <Readout
        icon={Database}
        label="Database"
        value={databaseUp ? formatMs(database.latencyMs) : 'Down'}
        valueClassName={databaseUp ? undefined : 'text-fail'}
        className="border-b xl:border-r xl:border-b-0"
      >
        <p>SQLite query round-trip</p>
        {database.error ? <p className="text-fail">{database.error}</p> : <p>Connected and answering</p>}
      </Readout>

      <Readout
        icon={Gauge}
        label="Requests, last 24 h"
        value={traffic ? formatNumber(traffic.totalRequests) : 'Off'}
        className="border-b sm:border-r sm:border-b-0"
      >
        {traffic ? (
          <>
            <p>
              {formatPercent(traffic.successRate)} succeeded, {formatNumber(traffic.failedRequests)} failed
            </p>
            <p>Average response {formatMs(traffic.averageResponseTimeMs)}</p>
          </>
        ) : (
          <p>
            {metricsEnabled
              ? 'Traffic stats are unavailable right now.'
              : 'Set METRICS_ENABLED=true in backend/.env to record traffic.'}
          </p>
        )}
      </Readout>

      <Readout icon={MemoryStick} label="Memory" value={formatBytes(runtime.memory.heapUsedBytes)}>
        <Meter value={runtime.memory.heapUsedBytes} max={runtime.memory.heapTotalBytes} label="Heap used" />
        <p>
          of {formatBytes(runtime.memory.heapTotalBytes)} heap, {formatBytes(runtime.memory.rssBytes)} resident
        </p>
      </Readout>
    </section>
  );
}
