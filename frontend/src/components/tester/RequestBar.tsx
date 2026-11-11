import { ChevronDown, Send, Square, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { MOD_KEY } from '@/lib/browser';
import { cn } from '@/lib/cn';
import { METHOD_TEXT, type HttpMethod } from '@/lib/http';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface RequestBarProps {
  method: HttpMethod;
  url: string;
  onMethodChange: (method: HttpMethod) => void;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
  /** The URL after {{variables}} are substituted (shown only when it differs). */
  resolvedUrl: string;
  missing: string[];
  environmentName: string | null;
}

export function RequestBar({
  method,
  url,
  onMethodChange,
  onUrlChange,
  onSend,
  onCancel,
  sending,
  resolvedUrl,
  missing,
  environmentName,
}: RequestBarProps) {
  const id = useId();
  const showResolved = resolvedUrl !== url && missing.length === 0;

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
      >
        <div className="flex min-w-0 flex-1 items-stretch rounded-[0.9rem] border border-line-strong bg-surface transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_20%,transparent)]">
          <label htmlFor={`${id}-method`} className="sr-only">
            Method
          </label>
          <div className="relative shrink-0">
            <select
              id={`${id}-method`}
              value={method}
              onChange={(event) => onMethodChange(event.target.value as HttpMethod)}
              className={cn(
                'h-11 appearance-none rounded-l-[0.9rem] bg-transparent pr-8 pl-3.5 font-mono text-[0.8125rem] font-semibold outline-none [&>option]:bg-canvas [&>option]:text-ink',
                METHOD_TEXT[method],
              )}
            >
              {METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
          </div>
          <span className="my-2.5 w-px bg-line" aria-hidden />
          <input
            id={`${id}-url`}
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            aria-label="Request URL"
            aria-describedby={missing.length || showResolved ? `${id}-resolved` : undefined}
            placeholder="https://api.example.com/items or {{baseUrl}}/items"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-[0.8125rem] text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        {sending ? (
          <Button variant="secondary" onClick={onCancel} className="h-11 px-4 max-sm:w-full" icon={<Square />}>
            Cancel
          </Button>
        ) : (
          <Button type="submit" className="h-11 px-5 max-sm:w-full" icon={<Send />} title={`Send (${MOD_KEY} + Enter)`}>
            Send
            <span className="ml-1 hidden items-center gap-0.5 opacity-70 xl:flex" aria-hidden>
              <Kbd className="border-accent-contrast/25 bg-transparent text-accent-contrast">{MOD_KEY}</Kbd>
              <Kbd className="border-accent-contrast/25 bg-transparent text-accent-contrast">↵</Kbd>
            </span>
          </Button>
        )}
      </form>

      {missing.length > 0 ? (
        <p id={`${id}-resolved`} className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-warn">
          <TriangleAlert className="size-3.5" aria-hidden />
          {missing.map((name) => `{{${name}}}`).join(', ')} {missing.length === 1 ? 'is' : 'are'} not defined
          {environmentName ? ` in “${environmentName}”` : ' — no environment is active'}.
          <Link to="/environments" className="font-medium underline-offset-2 hover:underline">
            Manage environments
          </Link>
        </p>
      ) : showResolved ? (
        <p id={`${id}-resolved`} className="mt-2 truncate text-xs text-ink-faint" title={resolvedUrl}>
          Sends to <span className="font-mono text-ink-muted">{resolvedUrl}</span>
        </p>
      ) : null}
    </div>
  );
}
