import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

interface MenuProps {
  /** Renders the trigger; spread the props onto a <button>. */
  trigger: (props: {
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => ReactNode;
  items: Array<MenuItem | 'separator'>;
  align?: 'start' | 'end';
  /** Content above the items (e.g. the signed-in account). */
  header?: ReactNode;
  className?: string;
}

/** Action menu with arrow-key navigation, closing on Escape, outside clicks and selection. */
export function Menu({ trigger, items, align = 'end', header, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) root.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
  };

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent) => {
    const entries = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      entries[(index + 1) % entries.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      entries[(index - 1 + entries.length) % entries.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      entries[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      entries.at(-1)?.focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div ref={root} className="relative">
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      <AnimatePresence>
        {open ? (
          <m.div
            ref={list}
            id={id}
            role="menu"
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute top-full z-50 mt-2 min-w-52 origin-top rounded-[0.9rem] border border-line-strong bg-surface-strong p-1.5 shadow-[0_20px_50px_-20px_rgb(2_4_11/0.6)] backdrop-blur-2xl',
              align === 'end' ? 'right-0' : 'left-0',
              className,
            )}
          >
            {header}
            {items.map((item, index) =>
              item === 'separator' ? (
                <div key={`separator-${index}`} role="separator" className="my-1.5 h-px bg-line" />
              ) : (
                <button
                  key={index}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] transition-colors outline-none disabled:opacity-50 [&_svg]:size-4',
                    item.tone === 'danger'
                      ? 'text-fail hover:bg-fail/10 focus-visible:bg-fail/10'
                      : 'text-ink hover:bg-line focus-visible:bg-line',
                  )}
                >
                  {item.icon ? <span className="flex text-ink-faint">{item.icon}</span> : null}
                  {item.label}
                </button>
              ),
            )}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
