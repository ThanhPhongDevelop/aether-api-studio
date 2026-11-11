import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { pageWindow } from '@/lib/pagination';
import type { PageMeta } from '@/types/models';
import { Button } from './Button';

interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  /** Plural noun for the summary, e.g. "products". */
  noun: string;
  className?: string;
}

export function Pagination({ meta, onPageChange, noun, className }: PaginationProps) {
  const { page, limit, total, totalPages } = meta;
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav
      aria-label={`${noun} pages`}
      className={cn('flex flex-wrap items-center justify-between gap-3 text-[0.8125rem]', className)}
    >
      <p className="text-ink-muted tabular-nums">
        {total === 0 ? `No ${noun}` : `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)} ${noun}`}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="size-8 px-0"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-ink-faint" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`Page ${entry}`}
                className={cn(
                  'h-8 min-w-8 rounded-lg px-2 tabular-nums transition-colors',
                  entry === page
                    ? 'bg-surface-strong text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                {entry}
              </button>
            ),
          )}
          <Button
            variant="ghost"
            size="sm"
            className="size-8 px-0"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
