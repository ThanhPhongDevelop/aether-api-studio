import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { controlStyles } from './Input';

interface SelectProps extends ComponentProps<'select'> {
  selectSize?: 'sm' | 'md';
}

/** Native select (keyboard and screen-reader behaviour for free), styled like the other fields. */
export function Select({ className, selectSize = 'md', children, ...rest }: SelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        className={cn(
          controlStyles,
          'appearance-none pr-9 pl-3',
          selectSize === 'sm' ? 'h-8 text-[0.8125rem]' : 'h-10 text-sm',
          '[&>option]:bg-canvas [&>option]:text-ink',
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
    </div>
  );
}
