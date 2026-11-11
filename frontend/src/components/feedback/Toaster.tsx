import { AnimatePresence, m } from 'framer-motion';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ToastItem, ToastTone } from '@/contexts/toast/toast-context';
import { cn } from '@/lib/cn';

const TONES: Record<ToastTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: 'text-ok' },
  error: { icon: CircleAlert, className: 'text-fail' },
  warning: { icon: TriangleAlert, className: 'text-warn' },
  info: { icon: Info, className: 'text-accent' },
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);

  // Count down only while the pointer and focus are elsewhere, so a toast being read never vanishes.
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(1_000, remaining.current - (Date.now() - started));
    };
  }, [paused, onDismiss, toast.id]);

  const { icon: Icon, className } = TONES[toast.tone];

  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full gap-3 rounded-[0.9rem] border border-line-strong bg-surface-strong p-3.5 pr-2.5 shadow-[0_18px_40px_-18px_rgb(2_4_11/0.55)] backdrop-blur-xl"
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-[0.8125rem] break-words text-ink-muted">{toast.description}</p>
        ) : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 rounded text-[0.8125rem] font-medium text-accent hover:underline"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="grid size-6 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-line hover:text-ink"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </m.li>
  );
}

export function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-4 sm:justify-end"
    >
      <ol className="flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}
