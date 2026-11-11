import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** What to do when there is nothing to show yet. */
export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <span className="grid size-11 place-items-center rounded-2xl border border-line bg-surface text-ink-faint">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[0.8125rem] text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Inline error with a retry button, for panels whose query failed. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fail/10 px-4 py-3 text-sm text-fail',
        className,
      )}
    >
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="rounded font-medium underline-offset-2 hover:underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}
