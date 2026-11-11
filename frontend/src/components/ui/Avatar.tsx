import { useState } from 'react';
import { cn } from '@/lib/cn';

const SIZES = { sm: 'size-7 text-[0.6875rem]', md: 'size-9 text-xs', lg: 'size-16 text-lg' } as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

/** A stable hue per name, so the same person always gets the same colour. */
function hue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-medium text-white',
        SIZES[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue(name)} 70% 52%), hsl(${(hue(name) + 48) % 360} 72% 44%))`,
      }}
      aria-hidden
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
          referrerPolicy="no-referrer"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
