import { useId } from 'react';
import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  /** Hide the "Aether / API Studio" wordmark and keep only the mark. */
  markOnly?: boolean;
}

/** Faceted prism mark — the only place besides the 3D core that uses the spectral gradient. */
export function Logo({ className, markOnly = false }: LogoProps) {
  const gradientId = `spectrum-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5BE7FF" />
            <stop offset="0.45" stopColor="#7B8CFF" />
            <stop offset="0.75" stopColor="#B69CFF" />
            <stop offset="1" stopColor="#FF8AD8" />
          </linearGradient>
        </defs>
        <path
          d="M16 4.75 25.75 10.4v11.2L16 27.25 6.25 21.6V10.4Z"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M16 10.5 21.5 20h-11Z" fill={`url(#${gradientId})`} />
      </svg>
      {markOnly ? null : (
        <span className="leading-none">
          <span className="block font-display text-[0.95rem] font-semibold tracking-tight text-ink">Aether</span>
          <span className="mt-1 block text-[0.6875rem] text-ink-faint">API Studio</span>
        </span>
      )}
    </span>
  );
}
