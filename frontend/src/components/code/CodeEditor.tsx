import { useDeferredValue, useMemo, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { HIGHLIGHT_LIMIT, highlightJson, highlightVariables } from '@/lib/highlight';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'json' | 'text';
  label: string;
  placeholder?: string;
  /** Colour `{{variables}}` by whether the active environment defines them. */
  isKnownVariable?: (name: string) => boolean;
  readOnly?: boolean;
  className?: string;
  /** Tailwind max-height class for the scroll area. */
  maxHeight?: string;
}

const MAX_GUTTER_LINES = 5_000;
const METRICS = 'font-mono text-[0.8125rem] leading-[1.6] tracking-normal';

/**
 * A textarea over a highlighted copy of its own text. Both sit in one grid
 * cell, so the editor grows with its content and scrolls as one surface.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  placeholder,
  isKnownVariable,
  readOnly,
  className,
  maxHeight = 'max-h-[26rem]',
}: CodeEditorProps) {
  const deferred = useDeferredValue(value);
  const highlighted = useMemo(() => {
    if (deferred.length > HIGHLIGHT_LIMIT) return deferred;
    if (language === 'json') return highlightJson(deferred);
    return isKnownVariable ? highlightVariables(deferred, isKnownVariable) : deferred;
  }, [deferred, language, isKnownVariable]);

  const lineCount = value.split('\n').length;
  const showGutter = lineCount <= MAX_GUTTER_LINES;

  // Keep the indentation of the current line on Enter.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const area = event.currentTarget;
    const before = area.value.slice(0, area.selectionStart);
    const indent = /(^|\n)([ \t]*)[^\n]*$/.exec(before)?.[2] ?? '';
    const opensBlock = /[{[]\s*$/.test(before);
    const insertion = `\n${indent}${opensBlock ? '  ' : ''}`;
    if (!indent && !opensBlock) return;
    event.preventDefault();
    // execCommand keeps the browser's undo history intact; fall back to a manual splice.
    if (!document.execCommand('insertText', false, insertion)) {
      const start = area.selectionStart;
      const next = area.value.slice(0, start) + insertion + area.value.slice(area.selectionEnd);
      onChange(next);
      requestAnimationFrame(() => area.setSelectionRange(start + insertion.length, start + insertion.length));
    }
  };

  return (
    <div
      className={cn(
        'overflow-auto rounded-xl border border-line bg-[color-mix(in_oklab,var(--canvas-deep)_55%,transparent)] focus-within:border-accent',
        maxHeight,
        className,
      )}
    >
      <div className="flex min-h-full min-w-fit">
        {showGutter ? (
          <div
            className={cn(
              METRICS,
              'sticky left-0 z-10 shrink-0 border-r border-line bg-[color-mix(in_oklab,var(--canvas-deep)_80%,transparent)] py-3 pr-2.5 pl-3 text-right text-ink-faint/70 select-none',
            )}
            aria-hidden
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
        ) : null}
        <div className="grid min-w-0 flex-1">
          <pre
            className={cn(METRICS, 'pointer-events-none px-3 py-3 whitespace-pre text-ink-muted [grid-area:1/1]')}
            aria-hidden
          >
            {highlighted}
            {/* A trailing line keeps the last (possibly empty) line measurable. */}
            {'\n'}
          </pre>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label={label}
            placeholder={placeholder}
            readOnly={readOnly}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={cn(
              METRICS,
              'min-h-40 resize-none overflow-hidden bg-transparent px-3 py-3 whitespace-pre text-transparent caret-[var(--ink)] outline-none [grid-area:1/1] placeholder:text-ink-faint selection:bg-accent/25 selection:text-transparent',
            )}
          />
        </div>
      </div>
    </div>
  );
}
