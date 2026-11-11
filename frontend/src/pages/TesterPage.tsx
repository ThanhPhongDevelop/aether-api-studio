import { useQueryClient } from '@tanstack/react-query';
import { Copy, FileUp, FolderOpen, MoreHorizontal, Plus, Save, SaveAll } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ImportCurlDialog } from '@/components/tester/ImportCurlDialog';
import { RequestBar } from '@/components/tester/RequestBar';
import { RequestEditor } from '@/components/tester/RequestEditor';
import { ResponsePanel } from '@/components/tester/ResponsePanel';
import { SaveRequestDialog } from '@/components/tester/SaveRequestDialog';
import { TesterRail } from '@/components/tester/TesterRail';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Menu } from '@/components/ui/Menu';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { pageTitle } from '@/config/app';
import { useConfirm } from '@/hooks/useConfirm';
import { useHotkey } from '@/hooks/useHotkey';
import { useSettings } from '@/hooks/useSettings';
import { useTester } from '@/hooks/useTester';
import { useToast } from '@/hooks/useToast';
import {
  useActiveEnvironment,
  useEnvironmentMutations,
  useSavedRequestMutations,
  workspaceKeys,
} from '@/hooks/useWorkspace';
import { copyText, MOD_KEY } from '@/lib/browser';
import { toCurl } from '@/lib/curl';
import { errorMessage } from '@/lib/form-errors';
import { createInterpolator, interpolate } from '@/lib/interpolate';
import { jsonError, prettyJson } from '@/lib/response';
import { draftFromHistory, resultFromHistory, testerStore, toSavedInput, type DraftRequest } from '@/lib/tester-store';
import { ApiError } from '@/services/api-client';
import { historyService, testerService } from '@/services/workspace.service';
import type { HistorySummary, RequestAuth, SavedRequest } from '@/types/models';

/** Substitute {{variables}} everywhere a request can use them. */
function resolveDraft(draft: DraftRequest, variables: ReadonlyMap<string, string>) {
  const interpolator = createInterpolator(variables);
  const urlResult = interpolate(draft.url.trim(), variables);
  const headers = draft.headers
    .filter((row) => row.key.trim())
    .map((row) => ({
      key: interpolator.resolve(row.key.trim()),
      value: interpolator.resolve(row.value),
      enabled: row.enabled,
    }));
  let auth: RequestAuth = draft.auth;
  if (auth.type === 'BEARER') auth = { type: 'BEARER', token: interpolator.resolve(auth.token) };
  if (auth.type === 'BASIC') {
    auth = {
      type: 'BASIC',
      username: interpolator.resolve(auth.username),
      password: interpolator.resolve(auth.password),
    };
  }
  const body = draft.bodyType === 'NONE' ? null : interpolator.resolve(draft.body);
  return {
    url: urlResult.value,
    urlMissing: urlResult.missing,
    otherMissing: interpolator.missing,
    headers,
    auth,
    body,
  };
}

export default function TesterPage() {
  const { draft, response, dirty, importOpen } = useTester();
  const { environment, environments, variables } = useActiveEnvironment();
  const environmentMutations = useEnvironmentMutations();
  const { replace } = useSavedRequestMutations();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [sending, setSending] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [saveDialog, setSaveDialog] = useState<'save' | 'save-as' | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const isKnownVariable = useCallback((name: string) => variables.has(name), [variables]);
  const urlPreview = useMemo(() => interpolate(draft.url.trim(), variables), [draft.url, variables]);

  /** Ask before throwing away unsaved edits. */
  const confirmDiscard = async () =>
    !dirty ||
    confirm({
      title: 'Discard unsaved changes?',
      description: `“${draft.name}” has edits that are not saved.`,
      confirmLabel: 'Discard changes',
      tone: 'danger',
    });

  const send = async () => {
    if (sending) return;
    const resolved = resolveDraft(draft, variables);
    if (!resolved.url) {
      toast.error('Enter a URL', 'For example {{baseUrl}}/health or https://api.example.com/items.');
      return;
    }
    if (resolved.urlMissing.length) {
      toast.error(
        'The URL uses undefined variables',
        `Define ${resolved.urlMissing.map((name) => `{{${name}}}`).join(', ')} in the active environment, or replace them.`,
      );
      return;
    }
    if (resolved.otherMissing.length) {
      toast.warning(
        'Some variables are not defined',
        `${resolved.otherMissing.map((name) => `{{${name}}}`).join(', ')} will be sent as typed.`,
      );
    }

    const abort = new AbortController();
    controller.current = abort;
    setSending(true);
    setStartedAt(performance.now());
    try {
      const result = await testerService.execute(
        {
          method: draft.method,
          url: resolved.url,
          headers: resolved.headers,
          queryParams: [],
          bodyType: draft.bodyType,
          body: resolved.body,
          auth: resolved.auth,
          timeoutMs: settings?.requestTimeoutMs,
          followRedirects,
          saveToHistory: true,
        },
        abort.signal,
      );
      testerStore.setResponse({ source: 'live', result, receivedAt: new Date().toISOString() });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.history });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard });
    } catch (error) {
      if (abort.signal.aborted) toast.info('Request cancelled');
      else if (error instanceof ApiError && error.code === 'TARGET_NOT_ALLOWED')
        toast.error('That address is blocked', error.message);
      else toast.error('The request could not be sent', errorMessage(error));
    } finally {
      controller.current = null;
      setSending(false);
      setStartedAt(null);
    }
  };

  const save = async (mode: 'save' | 'save-as' = 'save') => {
    if (mode === 'save-as' || !draft.savedRequestId) {
      setSaveDialog(mode);
      return;
    }
    try {
      const saved = await replace.mutateAsync({ id: draft.savedRequestId, input: toSavedInput(draft) });
      testerStore.markSaved(saved);
      toast.success('Request saved', saved.name);
    } catch (error) {
      toast.error('Request not saved', errorMessage(error));
    }
  };

  const formatBody = () => {
    if (draft.bodyType !== 'JSON') return;
    const problem = jsonError(draft.body);
    if (problem) toast.warning('Fix the JSON first', problem);
    else testerStore.update({ body: prettyJson(draft.body) });
  };

  const copyCurl = async () => {
    const resolved = resolveDraft(draft, variables);
    try {
      await copyText(
        toCurl({
          method: draft.method,
          url: resolved.url,
          headers: resolved.headers,
          bodyType: draft.bodyType,
          body: resolved.body,
          auth: resolved.auth,
        }),
      );
      toast.success('Copied as cURL', 'Variables are filled in from the active environment.');
    } catch (error) {
      toast.error('Could not copy', errorMessage(error));
    }
  };

  const openSaved = async (request: SavedRequest) => {
    if (request.id !== draft.savedRequestId && !(await confirmDiscard())) return;
    testerStore.loadSaved(request);
    setRailOpen(false);
  };

  const openHistory = async (entry: HistorySummary) => {
    if (!(await confirmDiscard())) return;
    try {
      const detail = await historyService.get(entry.id);
      const { draft: restored, droppedCredentials } = draftFromHistory(detail);
      testerStore.load(restored, {
        response: { source: 'history', result: resultFromHistory(detail), receivedAt: detail.createdAt },
      });
      setRailOpen(false);
      if (droppedCredentials)
        toast.info('Credentials were not stored', 'Add the Authorization header or token again before resending.');
    } catch (error) {
      toast.error('Could not open that request', errorMessage(error));
    }
  };

  const newRequest = async () => {
    if (await confirmDiscard()) testerStore.reset();
  };

  const saveToken = async (token: string) => {
    if (!environment) return;
    const next = environment.variables.map(({ key, value, isSecret, enabled }) => ({ key, value, isSecret, enabled }));
    const existing = next.find((variable) => variable.key === 'accessToken');
    if (existing) Object.assign(existing, { value: token, enabled: true });
    else next.push({ key: 'accessToken', value: token, isSecret: true, enabled: true });
    try {
      await environmentMutations.replace.mutateAsync({
        id: environment.id,
        input: { name: environment.name, variables: next },
      });
      toast.success(
        'Token saved',
        `{{accessToken}} in “${environment.name}” now holds it. Requests using Bearer {{accessToken}} are signed in.`,
      );
    } catch (error) {
      toast.error('Token not saved', errorMessage(error));
    }
  };

  useHotkey('mod+enter', () => void send(), { allowInInputs: true });
  useHotkey('mod+s', () => void save(), { allowInInputs: true });
  useHotkey('mod+shift+f', formatBody, { allowInInputs: true });

  const rail = (
    <TesterRail
      activeRequestId={draft.savedRequestId}
      onOpenSaved={(request) => void openSaved(request)}
      onOpenHistory={(entry) => void openHistory(entry)}
    />
  );

  return (
    <>
      <title>{pageTitle(`${draft.name} — API Tester`)}</title>
      <h1 className="sr-only">API Tester</h1>

      <div className="grid gap-6 pt-6 xl:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside aria-label="Collections and history" className="hidden xl:block">
          <div className="glass sticky top-22 h-[calc(100dvh-7.5rem)] rounded-[1.25rem] p-4">{rail}</div>
        </aside>

        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                value={draft.name}
                onChange={(event) => testerStore.update({ name: event.target.value })}
                aria-label="Request name"
                maxLength={120}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 font-display text-xl font-normal tracking-tight text-ink outline-none hover:bg-surface focus-visible:bg-surface focus-visible:shadow-[inset_0_0_0_1px_var(--accent)]"
              />
              {dirty ? (
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-faint">
                  <span className="size-1.5 rounded-full bg-warn" aria-hidden />
                  Unsaved
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<FolderOpen />}
                className="xl:hidden"
                onClick={() => setRailOpen(true)}
              >
                Collections
              </Button>
              <label className="sr-only" htmlFor="tester-environment">
                Environment
              </label>
              <Select
                id="tester-environment"
                selectSize="sm"
                className="w-44"
                value={environment?.id ?? ''}
                disabled={environmentMutations.activate.isPending}
                onChange={(event) =>
                  environmentMutations.activate.mutate(event.target.value || null, {
                    onError: (error) => toast.error('Environment not switched', errorMessage(error)),
                  })
                }
              >
                <option value="">No environment</option>
                {environments.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" size="sm" icon={<FileUp />} onClick={() => testerStore.openImport()}>
                Import cURL
              </Button>
              <Menu
                trigger={(props) => (
                  <Button
                    {...props}
                    variant="secondary"
                    size="sm"
                    className="size-8 px-0"
                    aria-label="More request actions"
                  >
                    <MoreHorizontal />
                  </Button>
                )}
                items={[
                  { label: 'New request', icon: <Plus />, onSelect: () => void newRequest() },
                  { label: 'Save as a copy…', icon: <SaveAll />, onSelect: () => void save('save-as') },
                  { label: 'Copy as cURL', icon: <Copy />, onSelect: () => void copyCurl() },
                ]}
              />
              <Button
                size="sm"
                icon={<Save />}
                loading={replace.isPending}
                onClick={() => void save()}
                title={`Save (${MOD_KEY} + S)`}
              >
                Save
              </Button>
            </div>
          </div>

          <Panel aria-label="Request" className="space-y-5">
            <RequestBar
              method={draft.method}
              url={draft.url}
              onMethodChange={(method) => testerStore.update({ method })}
              onUrlChange={testerStore.setUrl}
              onSend={() => void send()}
              onCancel={() => controller.current?.abort()}
              sending={sending}
              resolvedUrl={urlPreview.value}
              missing={urlPreview.missing}
              environmentName={environment?.name ?? null}
            />
            <RequestEditor
              key={draft.savedRequestId ?? 'draft'}
              draft={draft}
              onChange={testerStore.update}
              onParamsChange={testerStore.setParams}
              onFormatBody={formatBody}
              followRedirects={followRedirects}
              onFollowRedirectsChange={setFollowRedirects}
              isKnownVariable={isKnownVariable}
            />
          </Panel>

          <Panel aria-label="Response" aria-live="polite" aria-busy={sending}>
            <ResponsePanel
              response={response}
              sending={sending}
              startedAt={startedAt}
              onSaveToken={environment ? (token) => void saveToken(token) : null}
              savingToken={environmentMutations.replace.isPending}
            />
            {!environment && response?.result.status ? (
              <p className="mt-4 text-xs text-ink-faint">
                Tip: activate an environment to reuse values such as {'{{baseUrl}}'} and {'{{accessToken}}'}.{' '}
                <Link to="/environments" className="text-accent hover:underline">
                  Set one up
                </Link>
              </p>
            ) : null}
          </Panel>
        </div>
      </div>

      <Dialog open={railOpen} onClose={() => setRailOpen(false)} title="Collections and history" size="md">
        <div className="h-[min(70vh,36rem)]">{rail}</div>
      </Dialog>
      <SaveRequestDialog
        open={saveDialog !== null}
        onClose={() => setSaveDialog(null)}
        draft={draft}
        saveAs={saveDialog === 'save-as'}
      />
      <ImportCurlDialog open={importOpen} onClose={() => testerStore.closeImport()} />
    </>
  );
}
