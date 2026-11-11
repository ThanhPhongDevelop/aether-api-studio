import { Search, X } from 'lucide-react';
import { useRef } from 'react';
import { useHotkey } from '@/hooks/useHotkey';
import { Input } from './Input';
import { Kbd } from './Kbd';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  /** Focus with the "/" key (one search box per screen). */
  shortcut?: boolean;
  className?: string;
  inputSize?: 'sm' | 'md';
}

/** Search box with a clear button; callers debounce the value they query with. */
export function SearchInput({ value, onChange, placeholder, label, shortcut, className, inputSize }: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null);
  useHotkey('/', () => input.current?.focus(), { enabled: Boolean(shortcut) });

  return (
    <Input
      ref={input}
      type="search"
      role="searchbox"
      aria-label={label}
      value={value}
      inputSize={inputSize}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && value) {
          event.stopPropagation();
          onChange('');
        }
      }}
      placeholder={placeholder}
      className={className}
      leading={<Search />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              input.current?.focus();
            }}
            aria-label="Clear search"
            className="grid size-7 place-items-center rounded-md text-ink-faint hover:bg-line hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : shortcut ? (
          <Kbd className="mr-1.5 max-sm:hidden">/</Kbd>
        ) : undefined
      }
    />
  );
}
