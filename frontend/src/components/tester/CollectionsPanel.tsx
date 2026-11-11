import { ChevronRight, FolderPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { MethodBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { useCollectionMutations, useCollections, useSavedRequestMutations } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/form-errors';
import type { Collection, SavedRequest } from '@/types/models';

function NameForm({
  initial,
  label,
  onSubmit,
  onCancel,
  pending,
}: {
  initial: string;
  label: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };
  return (
    <form onSubmit={submit} className="flex gap-1.5">
      <Input
        autoFocus
        inputSize="sm"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && (event.stopPropagation(), onCancel())}
        aria-label={label}
        maxLength={80}
        placeholder="Collection name"
      />
      <Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>
        Save
      </Button>
    </form>
  );
}

interface CollectionsPanelProps {
  activeRequestId: string | null;
  onOpen: (request: SavedRequest) => void;
}

export function CollectionsPanel({ activeRequestId, onOpen }: CollectionsPanelProps) {
  const collections = useCollections();
  const { create, rename, remove } = useCollectionMutations();
  const savedRequests = useSavedRequestMutations();
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const visible = (collections.data ?? [])
    .map((collection) => ({
      ...collection,
      requests: term
        ? collection.requests.filter(
            (request) => request.name.toLowerCase().includes(term) || request.url.toLowerCase().includes(term),
          )
        : collection.requests,
    }))
    .filter((collection) => !term || collection.requests.length > 0 || collection.name.toLowerCase().includes(term));

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createCollection = async (name: string) => {
    try {
      await create.mutateAsync({ name });
      setCreating(false);
      toast.success('Collection created', name);
    } catch (error) {
      toast.error('Collection not created', errorMessage(error));
    }
  };

  const renameCollection = async (collection: Collection, name: string) => {
    try {
      await rename.mutateAsync({ id: collection.id, name });
      setRenaming(null);
      toast.success('Collection renamed');
    } catch (error) {
      toast.error('Collection not renamed', errorMessage(error));
    }
  };

  const deleteCollection = async (collection: Collection) => {
    const confirmed = await confirm({
      title: `Delete “${collection.name}”?`,
      description: `Its ${collection.requests.length} saved request${collection.requests.length === 1 ? '' : 's'} will be deleted too. Your history is kept.`,
      confirmLabel: 'Delete collection',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(collection.id);
      toast.success('Collection deleted', collection.name);
    } catch (error) {
      toast.error('Collection not deleted', errorMessage(error));
    }
  };

  const deleteRequest = async (request: SavedRequest) => {
    const confirmed = await confirm({
      title: `Delete “${request.name}”?`,
      description: 'The saved request is removed from its collection.',
      confirmLabel: 'Delete request',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await savedRequests.remove.mutateAsync(request.id);
      toast.success('Request deleted', request.name);
    } catch (error) {
      toast.error('Request not deleted', errorMessage(error));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Filter requests"
          label="Filter saved requests"
          inputSize="sm"
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          className="size-8 px-0"
          onClick={() => setCreating(true)}
          aria-label="New collection"
          title="New collection"
        >
          <FolderPlus />
        </Button>
      </div>
      {creating ? (
        <NameForm
          initial=""
          label="New collection name"
          onSubmit={(name) => void createCollection(name)}
          onCancel={() => setCreating(false)}
          pending={create.isPending}
        />
      ) : null}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {collections.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-8" />
            ))}
          </div>
        ) : collections.isError ? (
          <ErrorState message={errorMessage(collections.error)} onRetry={() => void collections.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            compact
            title={term ? 'No saved request matches' : 'No collections yet'}
            description={term ? 'Try another word.' : 'Create one, then save requests into it with Save.'}
          />
        ) : (
          <ul className="space-y-1">
            {visible.map((collection) => {
              const open = term !== '' || !collapsed.has(collection.id);
              return (
                <li key={collection.id}>
                  {renaming === collection.id ? (
                    <NameForm
                      initial={collection.name}
                      label={`Rename ${collection.name}`}
                      onSubmit={(name) => void renameCollection(collection, name)}
                      onCancel={() => setRenaming(null)}
                      pending={rename.isPending}
                    />
                  ) : (
                    <div className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(collection.id)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[0.8125rem] font-medium text-ink hover:bg-line/60"
                      >
                        <ChevronRight
                          className={cn('size-3.5 shrink-0 text-ink-faint transition-transform', open && 'rotate-90')}
                          aria-hidden
                        />
                        <span className="truncate">{collection.name}</span>
                        <span className="ml-auto pl-2 text-xs font-normal text-ink-faint tabular-nums">
                          {collection.requests.length}
                        </span>
                      </button>
                      <Menu
                        trigger={(props) => (
                          <button
                            type="button"
                            {...props}
                            aria-label={`Actions for ${collection.name}`}
                            className="grid size-7 shrink-0 place-items-center rounded-md text-ink-faint opacity-60 hover:bg-line hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </button>
                        )}
                        items={[
                          { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(collection.id) },
                          {
                            label: 'Delete collection',
                            icon: <Trash2 />,
                            tone: 'danger',
                            onSelect: () => void deleteCollection(collection),
                          },
                        ]}
                      />
                    </div>
                  )}
                  {open ? (
                    <ul className="mt-0.5 ml-3 space-y-px border-l border-line pl-2">
                      {collection.requests.length === 0 ? (
                        <li className="px-2 py-1.5 text-xs text-ink-faint">Empty. Save a request here.</li>
                      ) : (
                        collection.requests.map((request) => (
                          <li key={request.id} className="group flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpen(request)}
                              aria-current={request.id === activeRequestId ? 'true' : undefined}
                              className={cn(
                                'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[0.8125rem] transition-colors',
                                request.id === activeRequestId
                                  ? 'bg-surface-strong text-ink'
                                  : 'text-ink-muted hover:bg-line/60 hover:text-ink',
                              )}
                            >
                              <MethodBadge method={request.method} className="min-w-[3.1rem] text-[0.625rem]" />
                              <span className="truncate">{request.name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteRequest(request)}
                              aria-label={`Delete ${request.name}`}
                              className="grid size-7 shrink-0 place-items-center rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-fail/10 hover:text-fail group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
