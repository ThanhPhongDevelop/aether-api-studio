import { FileUp, Keyboard, LogIn, LogOut, Moon, Plus, Search, Sun, UserPlus, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { MethodBadge } from '@/components/ui/Badges';
import { Kbd } from '@/components/ui/Kbd';
import { ALL_NAV_ITEMS, canAccess } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useCollections } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { scoreCommand } from '@/lib/command-score';
import { testerStore } from '@/lib/tester-store';

interface PaletteCommand {
  id: string;
  group: 'Go to' | 'Actions' | 'Saved requests';
  label: string;
  detail?: string;
  icon: ReactNode;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

const GROUP_ORDER: PaletteCommand['group'][] = ['Go to', 'Actions', 'Saved requests'];
const icon = (Icon: LucideIcon) => <Icon className="size-4" aria-hidden />;

function PaletteBody({ onClose, onOpenShortcuts }: { onClose: () => void; onOpenShortcuts: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const toast = useToast();
  const { user, status, logout } = useAuth();
  const { resolved, setPreference } = useTheme();
  const collections = useCollections();
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);

  const commands = useMemo<PaletteCommand[]>(() => {
    const go = (to: string) => () => void navigate(to);
    const items: PaletteCommand[] = ALL_NAV_ITEMS.filter((item) => canAccess(item.access, user)).map((item) => ({
      id: `go:${item.to}`,
      group: 'Go to',
      label: item.label,
      icon: icon(item.icon),
      keywords: item.keywords,
      shortcut: item.shortcut,
      run: go(item.to),
    }));

    if (status === 'authenticated') {
      items.push(
        {
          id: 'action:new-request',
          group: 'Actions',
          label: 'New request',
          icon: icon(Plus),
          keywords: 'blank tester',
          run: () => {
            testerStore.reset();
            void navigate('/tester');
          },
        },
        {
          id: 'action:import-curl',
          group: 'Actions',
          label: 'Import from cURL',
          icon: icon(FileUp),
          keywords: 'paste command',
          run: () => {
            testerStore.openImport();
            void navigate('/tester');
          },
        },
      );
    }
    items.push(
      {
        id: 'action:theme',
        group: 'Actions',
        label: resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: icon(resolved === 'dark' ? Sun : Moon),
        keywords: 'appearance mode colour color',
        run: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'action:shortcuts',
        group: 'Actions',
        label: 'Keyboard shortcuts',
        icon: icon(Keyboard),
        keywords: 'keys help hotkeys',
        shortcut: '?',
        run: onOpenShortcuts,
      },
    );
    if (status === 'authenticated') {
      items.push({
        id: 'action:sign-out',
        group: 'Actions',
        label: 'Sign out',
        icon: icon(LogOut),
        keywords: 'logout log out',
        run: () =>
          void logout().then(() => {
            toast.success('Signed out');
            void navigate('/login', { replace: true });
          }),
      });
    } else {
      items.push(
        {
          id: 'action:sign-in',
          group: 'Actions',
          label: 'Sign in',
          icon: icon(LogIn),
          keywords: 'login',
          run: go('/login'),
        },
        {
          id: 'action:sign-up',
          group: 'Actions',
          label: 'Create an account',
          icon: icon(UserPlus),
          keywords: 'register sign up',
          run: go('/register'),
        },
      );
    }

    for (const collection of collections.data ?? []) {
      for (const request of collection.requests) {
        items.push({
          id: `request:${request.id}`,
          group: 'Saved requests',
          label: request.name,
          detail: collection.name,
          icon: <MethodBadge method={request.method} className="min-w-[3.1rem]" />,
          keywords: `${request.method} ${request.url}`,
          run: () => {
            testerStore.loadSaved(request);
            void navigate('/tester');
          },
        });
      }
    }
    return items;
  }, [user, status, resolved, collections.data, navigate, logout, setPreference, onOpenShortcuts, toast]);

  const results = useMemo(() => {
    const scored = commands
      .map((command) => ({ command, score: scoreCommand(command, query) }))
      .filter((entry) => entry.score > 0);
    // Without a query, saved requests would drown out navigation; show a handful.
    const savedRequests = scored.filter((entry) => entry.command.group === 'Saved requests');
    const limited = query
      ? scored
      : scored.filter((entry) => entry.command.group !== 'Saved requests' || savedRequests.indexOf(entry) < 5);
    return GROUP_ORDER.flatMap((group) =>
      limited
        .filter((entry) => entry.command.group === group)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.command),
    );
  }, [commands, query]);

  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const run = (command: PaletteCommand | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(1, results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((activeIndex - 1 + results.length) % Math.max(1, results.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[activeIndex]);
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;
  let lastGroup: string | null = null;

  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-line-strong bg-surface-strong shadow-[0_30px_80px_-30px_rgb(2_4_11/0.75)] backdrop-blur-2xl">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
          aria-label="Search screens, actions and saved requests"
          placeholder="Search screens, actions and saved requests"
          className="h-14 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-faint"
        />
        <Kbd>Esc</Kbd>
      </div>
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label="Results"
        className="max-h-[min(60vh,26rem)] overflow-y-auto p-2"
      >
        {results.length === 0 ? (
          <li className="px-3 py-10 text-center text-[0.8125rem] text-ink-faint" role="presentation">
            Nothing matches “{query}”.
          </li>
        ) : (
          results.map((command, index) => {
            const heading = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {heading ? (
                  <p className="px-3 pt-3 pb-1.5 text-xs text-ink-faint" role="presentation">
                    {heading}
                  </p>
                ) : null}
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onPointerMove={() => setActive(index)}
                  onClick={() => run(command)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                    index === activeIndex ? 'bg-line text-ink' : 'text-ink-muted',
                  )}
                >
                  <span className="flex shrink-0 text-ink-faint">{command.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.detail ? <span className="truncate text-xs text-ink-faint">{command.detail}</span> : null}
                  {command.shortcut ? (
                    <span className="flex gap-1" aria-hidden>
                      {command.shortcut.split(' ').map((key) => (
                        <Kbd key={key}>{key.toUpperCase()}</Kbd>
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenShortcuts: () => void;
}

export function CommandPalette({ open, onClose, onOpenShortcuts }: CommandPaletteProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Command palette"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => event.target === ref.current && onClose()}
      className="dialog-pop mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-visible bg-transparent p-0 text-ink backdrop:bg-[#02040b]/55 backdrop:backdrop-blur-sm"
    >
      {open ? <PaletteBody onClose={onClose} onOpenShortcuts={onOpenShortcuts} /> : null}
    </dialog>
  );
}
