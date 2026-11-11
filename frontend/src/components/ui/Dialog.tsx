import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Rendered only while open, so forms start fresh every time. */
  children: ReactNode;
  className?: string;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/**
 * Modal built on the native <dialog>: the browser traps focus, makes the page
 * behind it inert, handles Escape and returns focus to the trigger on close.
 */
export function Dialog({ open, onClose, title, description, size = 'md', children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault(); // state drives closing, so React stays the source of truth
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose(); // click on the backdrop
      }}
      className={cn(
        'dialog-pop m-auto w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 text-ink backdrop:bg-[#02040b]/65 backdrop:backdrop-blur-sm',
        SIZES[size],
      )}
    >
      {open ? (
        <div
          className={cn(
            'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.25rem] border border-line-strong bg-surface-strong p-5 shadow-[0_30px_80px_-30px_rgb(2_4_11/0.7)] backdrop-blur-2xl sm:p-6',
            className,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-lg font-normal tracking-tight">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-[0.8125rem] text-ink-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-line hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

/** Right-aligned action row at the bottom of a dialog form. */
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-6 flex flex-wrap justify-end gap-2', className)}>{children}</div>;
}
