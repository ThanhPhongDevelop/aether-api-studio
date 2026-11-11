import { Link } from 'react-router';
import { useConnectionStatus, type ConnectionState } from '@/hooks/useSystem';
import { cn } from '@/lib/cn';
import { formatMs } from '@/lib/format';
import { TONE_CLASSES, type Tone } from '@/lib/http';

const STATES: Record<ConnectionState, { label: string; tone: Tone }> = {
  checking: { label: 'Checking API', tone: 'neutral' },
  online: { label: 'API online', tone: 'ok' },
  degraded: { label: 'Database unavailable', tone: 'warn' },
  offline: { label: 'API offline', tone: 'fail' },
};

/** Live backend health in the header; opens the status page. */
export function ConnectionIndicator() {
  const { state, roundTripMs } = useConnectionStatus();
  const { label, tone } = STATES[state];

  return (
    <Link
      to="/status"
      title="Open system status"
      className="inline-flex h-8 items-center gap-2 rounded-full border border-line px-3 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <span className={cn('size-2 rounded-full', TONE_CLASSES[tone].dot, TONE_CLASSES[tone].glow)} aria-hidden />
      <span role="status" className="max-sm:sr-only">
        {label}
      </span>
      {state === 'online' && roundTripMs !== null ? (
        <span className="hidden tabular-nums text-ink-faint md:inline">{formatMs(roundTripMs)}</span>
      ) : null}
    </Link>
  );
}
