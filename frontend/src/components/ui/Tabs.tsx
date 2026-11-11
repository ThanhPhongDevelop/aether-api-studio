import { m } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** Small count or marker after the label. */
  badge?: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Prefix for tab/panel ids; pass the same to <TabPanel>. */
  idBase: string;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

const tabId = (base: string, value: string) => `${base}-tab-${value}`;
const panelId = (base: string, value: string) => `${base}-panel-${value}`;

/** WAI-ARIA tabs with arrow-key navigation and an animated underline. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idBase,
  label,
  className,
  size = 'md',
}: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);
  const indicator = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.value === value);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = items[next]!;
    onChange(target.value);
    list.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idBase, target.value))}`)?.focus();
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex items-center gap-1 overflow-x-auto border-b border-line', className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={tabId(idBase, item.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idBase, item.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 rounded-t-md px-3 transition-colors',
              size === 'sm' ? 'h-9 text-[0.8125rem]' : 'h-10 text-sm',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge !== null ? (
              <span className="rounded-full bg-line px-1.5 text-[0.6875rem] tabular-nums text-ink-muted">
                {item.badge}
              </span>
            ) : null}
            {selected ? (
              <m.span
                layoutId={indicator}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idBase,
  value,
  children,
  className,
}: {
  idBase: string;
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="tabpanel" id={panelId(idBase, value)} aria-labelledby={tabId(idBase, value)} className={className}>
      {children}
    </div>
  );
}
