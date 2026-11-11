import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Shared by every text control so fields line up and focus looks the same everywhere. */
export const controlStyles =
  'w-full min-w-0 rounded-[0.7rem] border border-line bg-surface text-ink placeholder:text-ink-faint ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-line-strong ' +
  'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_22%,transparent)] focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-fail/70';

interface InputProps extends ComponentProps<'input'> {
  /** Icon or text inside the field on the left. */
  leading?: ReactNode;
  /** Button or text inside the field on the right. */
  trailing?: ReactNode;
  inputSize?: 'sm' | 'md';
}

export function Input({ className, leading, trailing, inputSize = 'md', ...rest }: InputProps) {
  const sizing = inputSize === 'sm' ? 'h-8 text-[0.8125rem]' : 'h-10 text-sm';
  if (!leading && !trailing) return <input className={cn(controlStyles, sizing, 'px-3', className)} {...rest} />;

  return (
    <div className={cn('relative flex items-center', className)}>
      {leading ? (
        <span className="pointer-events-none absolute left-3 flex text-ink-faint [&_svg]:size-4">{leading}</span>
      ) : null}
      <input className={cn(controlStyles, sizing, leading ? 'pl-9' : 'pl-3', trailing ? 'pr-10' : 'pr-3')} {...rest} />
      {trailing ? <span className="absolute right-1.5 flex items-center">{trailing}</span> : null}
    </div>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return (
    <textarea className={cn(controlStyles, 'min-h-24 px-3 py-2.5 text-sm leading-relaxed', className)} {...rest} />
  );
}
