import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NotificationType } from '@/types/models';

const ICONS = {
  INFO: { icon: Info, className: 'bg-accent/12 text-accent' },
  SUCCESS: { icon: CircleCheck, className: 'bg-ok/12 text-ok' },
  WARNING: { icon: TriangleAlert, className: 'bg-warn/14 text-warn' },
  ERROR: { icon: CircleAlert, className: 'bg-fail/12 text-fail' },
} as const;

export function NotificationIcon({ type, className }: { type: NotificationType; className?: string }) {
  const { icon: Icon, className: tone } = ICONS[type];
  return (
    <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', tone, className)} aria-hidden>
      <Icon className="size-3.5" />
    </span>
  );
}
