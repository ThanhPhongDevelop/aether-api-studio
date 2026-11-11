import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[0.7rem] font-medium whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-55';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:glow-accent',
  secondary: 'glass text-ink hover:border-line-strong hover:bg-surface-strong',
  ghost: 'text-ink-muted hover:bg-surface hover:text-ink',
  danger: 'bg-fail text-white hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--fail)_22%,transparent)]',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1.5 rounded-lg px-2 text-xs [&_svg]:size-3.5',
  sm: 'h-8 px-3 text-[0.8125rem] [&_svg]:size-3.5',
  md: 'h-10 px-4 text-sm [&_svg]:size-4',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Shared by <Button>, <ButtonLink> and plain anchors that should look like buttons. */
export function buttonStyles({ variant = 'primary', size = 'md', className }: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

/** Square icon-only button sizing (pair with an aria-label). */
export const ICON_BUTTON = { xs: 'size-7 px-0', sm: 'size-8 px-0', md: 'size-10 px-0' } as const;
