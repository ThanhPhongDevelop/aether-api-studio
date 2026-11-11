import { m } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** A small set of mutually exclusive choices (a radio group drawn as one control). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const indicator = useId();
  const enabled = options.filter((option) => !option.disabled);

  const onKeyDown = (event: KeyboardEvent) => {
    const index = enabled.findIndex((option) => option.value === value);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
    if (next === -1) return;
    event.preventDefault();
    const target = enabled[next]!;
    onChange(target.value);
    group.current?.querySelector<HTMLButtonElement>(`[data-value="${target.value}"]`)?.focus();
  };

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('inline-flex h-8 items-center rounded-[0.7rem] border border-line bg-surface p-0.5', className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={checked}
            disabled={option.disabled}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative h-full rounded-[0.55rem] px-3 text-[0.8125rem] transition-colors disabled:opacity-40',
              checked ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {checked ? (
              <m.span
                layoutId={indicator}
                className="absolute inset-0 rounded-[0.55rem] bg-surface-strong shadow-[inset_0_0_0_1px_var(--line-strong)]"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                aria-hidden
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
