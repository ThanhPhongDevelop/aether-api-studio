import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { buttonStyles, type ButtonSize, type ButtonVariant } from './button-styles';
import { Spinner } from './Spinner';

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export interface ButtonProps extends ComponentProps<'button'>, StyleProps {
  /** Shows a spinner and disables the button while an action is running. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  icon,
  loading = false,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, className, children, ...rest }: LinkProps & StyleProps) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
