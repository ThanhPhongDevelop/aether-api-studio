import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  error: { icon: CircleAlert, className: 'bg-fail/10 text-fail' },
  warning: { icon: TriangleAlert, className: 'bg-warn/12 text-warn' },
  info: { icon: Info, className: 'bg-accent/10 text-accent' },
} as const;

/** Inline message inside a form or panel (toasts are for things that happened elsewhere). */
export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-xl px-3.5 py-3 text-[0.8125rem]', toneClass, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
