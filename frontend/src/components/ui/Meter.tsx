import { cn } from '@/lib/cn';
import { TONE_CLASSES, type Tone } from '@/lib/http';

interface MeterProps {
  value: number;
  max: number;
  label: string;
  tone?: Tone;
  className?: string;
}

export function Meter({ value, max, label, tone, className }: MeterProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          tone ? TONE_CLASSES[tone].dot : 'bg-accent',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
