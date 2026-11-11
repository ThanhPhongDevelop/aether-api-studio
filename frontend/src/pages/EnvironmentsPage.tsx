import { CircleCheck, Lock, LockOpen, Plus, Trash2, Variable } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ToneBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { KeyValueEditor } from '@/components/ui/KeyValueEditor';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/app';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { useEnvironmentMutations, useEnvironments } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { errorMessage, fieldErrorsFrom, type FieldErrors } from '@/lib/form-errors';
import { formatRelative } from '@/lib/format';
import { rowId, type ParamRow } from '@/lib/query-string';
import type { Environment } from '@/types/models';

type VariableRow = ParamRow & { isSecret: boolean };

const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;

function validateRows(rows: VariableRow[]): FieldErrors {
  const errors: FieldErrors = {};
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (!row.key && !row.value) return;
    if (!row.key) errors[`variables.${index}.key`] = 'Give this variable a name';
    else if (!KEY_PATTERN.test(row.key))
      errors[`variables.${index}.key`] = `“${row.key}” can only use letters, digits, “_”, “.” and “-”`;
    else if (seen.has(row.key)) errors[`variables.${index}.key`] = `“${row.key}” is defined twice`;
    seen.add(row.key);
  });
  return errors;
}

function EnvironmentEditor({
  environment,
  onDeleted,
  dirtyRef,
}: {
  environment: Environment;
  onDeleted: () => void;
  dirtyRef: RefObject<boolean>;
}) {
  const { replace, remove, activate } = useEnvironmentMutations();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(environment.name);
  const [rows, setRows] = useState<VariableRow[]>(() =>
    environment.variables.map((variable) => ({ ...variable, id: rowId() })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const snapshot = (list: VariableRow[]) =>
    JSON.stringify(
      list
        .filter((row) => row.key || row.value)
        .map(({ key, value, isSecret, enabled }) => [key, value, isSecret, enabled]),
    );
  const dirty =
    name !== environment.name ||
    snapshot(rows) !== snapshot(environment.variables.map((variable) => ({ ...variable, id: '' })));

  // Lets the page ask before switching away from unsaved edits.
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty, dirtyRef]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const kept = rows.filter((row) => row.key || row.value);
    const local = validateRows(kept);
    if (!name.trim()) local.name = 'Give the environment a name';
    setErrors(local);
    if (Object.keys(local).length) {
      toast.error('Check the highlighted variables', Object.values(local)[0]);
      return;
    }
    try {
      await replace.mutateAsync({
        id: environment.id,
        input: {
          name: name.trim(),
          variables: kept.map(({ key, value, isSecret, enabled }) => ({
            key,
            value,
            isSecret: Boolean(isSecret),
            enabled,
          })),
        },
      });
      toast.success('Environment saved', `${kept.length} variable${kept.length === 1 ? '' : 's'} in “${name.trim()}”.`);
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      toast.error('Environment not saved', errorMessage(error));
    }
  };

  const destroy = async () => {
    const confirmed = await confirm({
      title: `Delete “${environment.name}”?`,
      description: 'Its variables are deleted. Requests that use them will show the {{names}} as undefined.',
      confirmLabel: 'Delete environment',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(environment.id);
      toast.success('Environment deleted', environment.name);
      onDeleted();
    } catch (error) {
      toast.error('Environment not deleted', errorMessage(error));
    }
  };

  const rowErrors = Object.entries(errors).filter(([key]) => key.startsWith('variables.'));

  return (
    <form onSubmit={save} noValidate className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Name" error={errors.name} className="min-w-56 flex-1">
          {(control) => (
            <Input {...control} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          {environment.isActive ? (
            <Button
              variant="secondary"
              onClick={() =>
                activate.mutate(null, { onError: (error) => toast.error('Not deactivated', errorMessage(error)) })
              }
              loading={activate.isPending}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon={<CircleCheck />}
              onClick={() =>
                activate.mutate(environment.id, {
                  onSuccess: () =>
                    toast.success(
                      'Environment active',
                      `The API Tester now resolves variables from “${environment.name}”.`,
                    ),
                  onError: (error) => toast.error('Not activated', errorMessage(error)),
                })
              }
              loading={activate.isPending}
            >
              Make active
            </Button>
          )}
          <Button
            variant="ghost"
            icon={<Trash2 />}
            onClick={() => void destroy()}
            className="text-fail hover:bg-fail/10 hover:text-fail"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[0.9375rem] font-semibold">Variables</h2>
          <p className="text-xs text-ink-faint">
            Use them as <span className="font-mono text-ink-muted">{'{{name}}'}</span> in URLs, headers, auth and
            bodies.
          </p>
        </div>
        <KeyValueEditor<VariableRow>
          rows={rows}
          onChange={setRows}
          label="Environment variables"
          keyPlaceholder="Variable"
          valuePlaceholder="Value"
          newRow={{ isSecret: false }}
          maskValue={(row) => row.isSecret}
          renderExtra={(row, update) => (
            <button
              type="button"
              onClick={() => update({ isSecret: !row.isSecret })}
              aria-pressed={row.isSecret}
              aria-label={
                row.isSecret
                  ? `Show the value of ${row.key || 'this variable'}`
                  : `Mask the value of ${row.key || 'this variable'}`
              }
              title={row.isSecret ? 'Secret: value is masked' : 'Mark as secret'}
              className={cn(
                'grid size-7 place-items-center rounded-md transition-colors hover:bg-line',
                row.isSecret ? 'text-warn' : 'text-ink-faint hover:text-ink',
              )}
            >
              {row.isSecret ? <Lock className="size-3.5" aria-hidden /> : <LockOpen className="size-3.5" aria-hidden />}
            </button>
          )}
        />
        {rowErrors.length ? (
          <ul className="space-y-0.5 text-xs text-fail" role="alert">
            {rowErrors.map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-ink-faint">
          Secret values are masked on screen. They are stored in the database under your account, never in this browser.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
        {dirty ? <span className="mr-auto text-xs text-ink-faint">Unsaved changes</span> : null}
        <Button type="submit" loading={replace.isPending} disabled={!dirty}>
          Save environment
        </Button>
      </div>
    </form>
  );
}

function CreateEnvironmentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New environment"
      description="For example Staging or Production. Add its variables after creating it."
    >
      <CreateEnvironmentForm onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

function CreateEnvironmentForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { create } = useEnvironmentMutations();
  const toast = useToast();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Give the environment a name' });
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        variables: baseUrl.trim()
          ? [
              { key: 'baseUrl', value: baseUrl.trim(), isSecret: false, enabled: true },
              { key: 'accessToken', value: '', isSecret: true, enabled: true },
            ]
          : [],
      });
      toast.success('Environment created', created.name);
      onCreated(created.id);
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      toast.error('Environment not created', errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Name" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Staging"
          />
        )}
      </Field>
      <Field
        label="Base URL"
        aside="Optional"
        hint="Becomes {{baseUrl}}; an empty {{accessToken}} is added next to it."
      >
        {(control) => (
          <Input
            {...control}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://staging.example.com/api"
            className="font-mono"
            spellCheck={false}
          />
        )}
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Create environment
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function EnvironmentsPage() {
  const environments = useEnvironments();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editorDirty = useRef(false);

  const select = async (id: string) => {
    if (editorDirty.current) {
      const discard = await confirm({
        title: 'Discard unsaved changes?',
        description: 'The variables you edited have not been saved.',
        confirmLabel: 'Discard changes',
        tone: 'danger',
      });
      if (!discard) return;
    }
    editorDirty.current = false;
    setSelectedId(id);
  };

  const list = environments.data ?? [];
  const selected =
    list.find((environment) => environment.id === selectedId) ??
    list.find((environment) => environment.isActive) ??
    list[0] ??
    null;

  return (
    <>
      <title>{pageTitle('Environments')}</title>
      <PageHeader
        title="Environments"
        description="Named sets of variables. The active one fills in {{name}} placeholders when the API Tester sends a request."
        actions={
          <Button icon={<Plus />} onClick={() => setCreating(true)}>
            New environment
          </Button>
        }
      />

      {environments.isPending ? (
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Skeleton className="h-48 rounded-[1.25rem]" />
          <Skeleton className="h-96 rounded-[1.25rem]" />
        </div>
      ) : environments.isError ? (
        <ErrorState message={errorMessage(environments.error)} onRetry={() => void environments.refetch()} />
      ) : list.length === 0 || !selected ? (
        <EmptyState
          icon={Variable}
          title="No environments yet"
          description="Create one to keep values such as the base URL and access token out of your saved requests."
          action={<Button onClick={() => setCreating(true)}>Create an environment</Button>}
          className="glass rounded-[1.25rem]"
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Environments" className="glass rounded-[1.25rem] p-2">
            <ul className="space-y-0.5">
              {list.map((environment) => (
                <li key={environment.id}>
                  <button
                    type="button"
                    onClick={() => void select(environment.id)}
                    aria-current={environment.id === selected.id ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      environment.id === selected.id ? 'bg-surface-strong' : 'hover:bg-line/60',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{environment.name}</span>
                      <span className="block text-xs text-ink-faint">
                        {environment.variables.length} variable{environment.variables.length === 1 ? '' : 's'}, edited{' '}
                        {formatRelative(environment.updatedAt)}
                      </span>
                    </span>
                    {environment.isActive ? <ToneBadge tone="ok">Active</ToneBadge> : null}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <Panel>
            {/* Remount per environment version so the form starts from what is saved. */}
            <EnvironmentEditor
              key={`${selected.id}:${selected.updatedAt}`}
              environment={selected}
              onDeleted={() => setSelectedId(null)}
              dirtyRef={editorDirty}
            />
          </Panel>
        </div>
      )}

      <CreateEnvironmentDialog open={creating} onClose={() => setCreating(false)} onCreated={setSelectedId} />
    </>
  );
}
