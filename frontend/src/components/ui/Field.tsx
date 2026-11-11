import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Shown after the label, e.g. "Optional" or a "Forgot?" link. */
  aside?: ReactNode;
  className?: string;
  /** Receives the id and ARIA wiring for the control. */
  children: (control: ControlProps) => ReactNode;
}

/** Label, control, hint and error message, connected for assistive technology. */
export function Field({ label, hint, error, aside, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink">
          {label}
        </label>
        {aside ? <span className="text-xs text-ink-faint">{aside}</span> : null}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={errorId} className="text-xs text-fail">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
