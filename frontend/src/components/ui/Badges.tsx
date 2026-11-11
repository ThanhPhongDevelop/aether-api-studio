import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { isHttpMethod, METHOD_CLASSES, TONE_CLASSES, type Tone } from '@/lib/http';

export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums',
        TONE_CLASSES[tone].soft,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', TONE_CLASSES[tone].dot)} aria-hidden />
      {children}
    </span>
  );
}

/** HTTP method chip, coloured like every other method label in the app. */
export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const classes = isHttpMethod(method) ? METHOD_CLASSES[method] : 'bg-line text-ink-muted';
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.4rem] justify-center rounded-md px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium',
        classes,
        className,
      )}
    >
      {method}
    </span>
  );
}
