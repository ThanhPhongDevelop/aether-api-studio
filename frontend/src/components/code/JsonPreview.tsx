import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { highlightJson } from '@/lib/highlight';

interface JsonPreviewProps {
  code: string;
  /** Highlight as JSON (default) or show as plain text. */
  language?: 'json' | 'text';
  /** Wrap long lines instead of scrolling sideways. */
  wrap?: boolean;
  className?: string;
}

export function JsonPreview({ code, language = 'json', wrap = false, className }: JsonPreviewProps) {
  const content = useMemo(() => (language === 'json' ? highlightJson(code) : code), [code, language]);
  return (
    <pre
      className={cn(
        'overflow-auto font-mono text-[0.78rem] leading-relaxed text-ink-muted',
        wrap && 'break-words whitespace-pre-wrap',
        className,
      )}
    >
      <code>{content}</code>
    </pre>
  );
}
