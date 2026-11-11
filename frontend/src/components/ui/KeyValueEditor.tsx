import { Trash2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { rowId, type ParamRow } from '@/lib/query-string';

const cell =
  'h-9 w-full min-w-0 bg-transparent px-2.5 font-mono text-[0.8125rem] text-ink placeholder:text-ink-faint/80 outline-none ' +
  'focus-visible:bg-surface focus-visible:shadow-[inset_0_0_0_1px_var(--accent)] rounded-md';

interface KeyValueEditorProps<T extends ParamRow> {
  rows: T[];
  onChange: (rows: T[]) => void;
  /** Accessible name of the table, e.g. "Query parameters". */
  label: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** Offered as autocomplete for the key column. */
  keySuggestions?: string[];
  /** Extra controls per row (e.g. a "secret" toggle), shown before the delete button. */
  renderExtra?: (row: T, update: (patch: Partial<T>) => void) => ReactNode;
  /** Mask values (secrets). */
  maskValue?: (row: T) => boolean;
  /** Fields a newly added row starts with (beyond key, value and enabled). */
  newRow?: Partial<T>;
  className?: string;
}

/**
 * Editable key/value rows with a trailing blank row: typing into it adds a row.
 * The blank row's id becomes the new row's id, so focus never jumps.
 */
export function KeyValueEditor<T extends ParamRow = ParamRow>({
  rows,
  onChange,
  label,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keySuggestions,
  renderExtra,
  maskValue,
  newRow,
  className,
}: KeyValueEditorProps<T>) {
  const [pendingId, setPendingId] = useState(rowId);
  const listId = useId();

  const update = (id: string, patch: Partial<T>) => {
    if (id === pendingId) {
      onChange([...rows, { ...newRow, id, key: '', value: '', enabled: true, ...patch } as T]);
      setPendingId(rowId());
      return;
    }
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const remove = (id: string) => onChange(rows.filter((row) => row.id !== id));
  const all: T[] = [...rows, { ...newRow, id: pendingId, key: '', value: '', enabled: true } as T];

  return (
    <div className={cn('overflow-hidden rounded-xl border border-line', className)} role="table" aria-label={label}>
      <div role="rowgroup">
        <div
          role="row"
          className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] border-b border-line bg-line/40 text-xs text-ink-faint"
        >
          <span role="columnheader" className="sr-only">
            Enabled
          </span>
          <span role="columnheader" className="col-start-2 px-2.5 py-1.5">
            {keyPlaceholder}
          </span>
          <span role="columnheader" className="px-2.5 py-1.5">
            {valuePlaceholder}
          </span>
          <span role="columnheader" className="w-9 sr-only">
            Actions
          </span>
        </div>
      </div>
      <div role="rowgroup" className="divide-y divide-line">
        {all.map((row, index) => {
          const isPending = row.id === pendingId;
          const masked = !isPending && maskValue?.(row);
          return (
            <div
              key={row.id}
              role="row"
              className={cn(
                'grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center',
                !row.enabled && !isPending && 'opacity-55',
              )}
            >
              <span role="cell" className="grid place-items-center">
                {isPending ? null : (
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) => update(row.id, { enabled: event.target.checked } as Partial<T>)}
                    aria-label={`Include row ${index + 1}`}
                    className="size-4 cursor-pointer accent-[var(--accent)]"
                  />
                )}
              </span>
              <span role="cell" className="border-r border-line px-1 py-0.5">
                <input
                  value={row.key}
                  onChange={(event) => update(row.id, { key: event.target.value } as Partial<T>)}
                  placeholder={isPending ? `Add ${keyPlaceholder.toLowerCase()}` : keyPlaceholder}
                  aria-label={`${keyPlaceholder} ${index + 1}`}
                  list={keySuggestions ? listId : undefined}
                  spellCheck={false}
                  autoComplete="off"
                  className={cell}
                />
              </span>
              <span role="cell" className="px-1 py-0.5">
                <input
                  value={row.value}
                  onChange={(event) => update(row.id, { value: event.target.value } as Partial<T>)}
                  placeholder={valuePlaceholder}
                  aria-label={`${valuePlaceholder} ${index + 1}`}
                  type={masked ? 'password' : 'text'}
                  spellCheck={false}
                  autoComplete="off"
                  className={cell}
                />
              </span>
              <span role="cell" className="flex items-center gap-0.5 pr-1.5">
                {!isPending && renderExtra ? renderExtra(row, (patch) => update(row.id, patch)) : null}
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  disabled={isPending}
                  aria-label={`Remove row ${index + 1}`}
                  className="grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-fail/10 hover:text-fail disabled:invisible"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      {keySuggestions ? (
        <datalist id={listId}>
          {keySuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
