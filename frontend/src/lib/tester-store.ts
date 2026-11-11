/**
 * State of the API Tester: the request being edited and the last response.
 *
 * It lives at module level, so a draft survives moving between screens, and in
 * memory only: drafts can hold tokens and passwords, and nothing secret is ever
 * written to browser storage.
 */
import type { HttpMethod } from './http';
import { paramsFromUrl, parseQuery, rowId, splitUrl, urlFromParams, type ParamRow } from './query-string';
import type {
  BodyType,
  ExecuteResult,
  HistoryDetail,
  KeyValue,
  RequestAuth,
  RequestSpec,
  SavedRequest,
  SavedRequestInput,
} from '@/types/models';

export interface DraftRequest {
  name: string;
  savedRequestId: string | null;
  collectionId: string | null;
  method: HttpMethod;
  /** As typed, including the enabled query parameters. */
  url: string;
  params: ParamRow[];
  headers: ParamRow[];
  bodyType: BodyType;
  body: string;
  auth: RequestAuth;
}

export interface TesterResponse {
  source: 'live' | 'history';
  result: ExecuteResult;
  receivedAt: string;
}

export interface TesterState {
  draft: DraftRequest;
  /** Serialized saved version, for the "unsaved changes" marker. */
  baseline: string;
  response: TesterResponse | null;
  /** The cURL import dialog is open (it can be requested from the command palette). */
  importOpen: boolean;
}

export const UNTITLED = 'Untitled request';

export const blankDraft = (): DraftRequest => ({
  name: UNTITLED,
  savedRequestId: null,
  collectionId: null,
  method: 'GET',
  url: '{{baseUrl}}/health',
  params: [],
  headers: [],
  bodyType: 'NONE',
  body: '',
  auth: { type: 'NONE' },
});

const toRows = (items: KeyValue[]): ParamRow[] => items.map((item) => ({ ...item, id: rowId() }));
const fromRows = (rows: ParamRow[]): KeyValue[] =>
  rows.filter((row) => row.key || row.value).map(({ key, value, enabled }) => ({ key, value, enabled }));

/** What gets compared to decide whether the draft differs from its saved version. */
function fingerprint(draft: DraftRequest): string {
  return JSON.stringify([
    draft.name,
    draft.method,
    draft.url,
    fromRows(draft.params),
    fromRows(draft.headers),
    draft.bodyType,
    draft.bodyType === 'NONE' ? '' : draft.body,
    draft.auth,
    draft.collectionId,
  ]);
}

let state: TesterState = (() => {
  const draft = blankDraft();
  return { draft, baseline: fingerprint(draft), response: null, importOpen: false };
})();
const listeners = new Set<() => void>();

function publish(next: TesterState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export interface LoadableRequest extends Partial<RequestSpec> {
  name?: string;
  savedRequestId?: string | null;
  collectionId?: string | null;
}

/** Build a draft from a saved request, docs example, cURL import or history entry. */
export function draftFrom(source: LoadableRequest): DraftRequest {
  const rawUrl = source.url ?? '';
  const fromUrl = parseQuery(splitUrl(rawUrl).query).map((pair) => ({ ...pair, enabled: true, id: rowId() }));
  const params = [...fromUrl, ...toRows(source.queryParams ?? [])];
  return {
    name: source.name ?? UNTITLED,
    savedRequestId: source.savedRequestId ?? null,
    collectionId: source.collectionId ?? null,
    method: source.method ?? 'GET',
    url: urlFromParams(rawUrl, params),
    params,
    headers: toRows(source.headers ?? []),
    bodyType: source.bodyType ?? 'NONE',
    body: source.body ?? '',
    auth: source.auth ?? { type: 'NONE' },
  };
}

/** The saveable form: base URL plus every parameter row (disabled ones too). */
export function toSavedInput(draft: DraftRequest, overrides: Partial<SavedRequestInput> = {}): SavedRequestInput {
  const { base, hash } = splitUrl(draft.url);
  return {
    name: draft.name.trim() || UNTITLED,
    description: null,
    collectionId: draft.collectionId,
    method: draft.method,
    url: `${base}${hash}`,
    queryParams: fromRows(draft.params),
    headers: fromRows(draft.headers),
    bodyType: draft.bodyType,
    body: draft.bodyType === 'NONE' ? null : draft.body,
    auth: draft.auth,
    ...overrides,
  };
}

/** Headers the executor adds itself; replaying them from history would only duplicate them. */
const MANAGED_HEADERS = new Set(['content-length', 'host', 'accept-encoding', 'connection', 'transfer-encoding']);
const MASKED = '••••••';

/** A history entry back into an editable request (masked credentials are dropped). */
export function draftFromHistory(entry: HistoryDetail): { draft: DraftRequest; droppedCredentials: boolean } {
  let droppedCredentials = false;
  const headers = entry.requestHeaders.filter(({ key, value }) => {
    const name = key.toLowerCase();
    if (value === MASKED) {
      droppedCredentials = true;
      return false;
    }
    if (MANAGED_HEADERS.has(name)) return false;
    if (name === 'user-agent' && value.startsWith('AetherApiStudio/')) return false;
    if (name === 'accept' && value === '*/*') return false;
    if (name === 'content-type' && entry.bodyType !== 'NONE') {
      // Recreated from the body type unless it was something custom.
      return !['application/json', 'text/plain'].some((type) => value.startsWith(type));
    }
    return true;
  });
  const draft = draftFrom({
    name: `${entry.method} ${hostAndPath(entry.url)}`,
    method: entry.method,
    url: entry.url,
    headers: headers.map((header) => ({ ...header, enabled: true })),
    bodyType: entry.bodyType,
    body: entry.requestBody ?? '',
  });
  return { draft, droppedCredentials };
}

export function resultFromHistory(entry: HistoryDetail): ExecuteResult {
  const contentType = entry.responseHeaders.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? null;
  return {
    method: entry.method,
    requestUrl: entry.url,
    finalUrl: entry.url,
    status: entry.statusCode ?? 0,
    statusText: entry.statusText ?? (entry.statusCode ? '' : 'No response'),
    ok: entry.statusCode !== null && entry.statusCode >= 200 && entry.statusCode < 400,
    headers: entry.responseHeaders,
    body: entry.responseBody ?? '',
    bodyEncoding: 'utf8',
    contentType,
    sizeBytes: entry.responseSize,
    headersSizeBytes: 0,
    truncated: false,
    durationMs: entry.durationMs,
    ttfbMs: null,
    redirects: 0,
    requestHeaders: entry.requestHeaders,
    error: entry.errorMessage ? { code: 'REQUEST_FAILED', message: entry.errorMessage } : null,
    historyId: entry.id,
  };
}

export function hostAndPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

export const testerStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  update(patch: Partial<DraftRequest> | ((draft: DraftRequest) => Partial<DraftRequest>)) {
    const changes = typeof patch === 'function' ? patch(state.draft) : patch;
    publish({ ...state, draft: { ...state.draft, ...changes } });
  },

  /** Edit the URL; the Params table follows. */
  setUrl(url: string) {
    publish({ ...state, draft: { ...state.draft, url, params: paramsFromUrl(url, state.draft.params) } });
  },

  /** Edit the Params table; the URL follows. */
  setParams(params: ParamRow[]) {
    publish({ ...state, draft: { ...state.draft, params, url: urlFromParams(state.draft.url, params) } });
  },

  /** Replace the draft; `saved` marks it as matching its stored version. */
  load(draft: DraftRequest, options: { response?: TesterResponse | null; saved?: boolean } = {}) {
    publish({
      ...state,
      draft,
      baseline: options.saved ? fingerprint(draft) : '',
      response: options.response ?? null,
    });
  },

  loadSaved(request: SavedRequest) {
    testerStore.load(draftFrom({ ...request, savedRequestId: request.id, collectionId: request.collectionId }), {
      saved: true,
    });
  },

  reset() {
    const draft = blankDraft();
    publish({ ...state, draft, baseline: fingerprint(draft), response: null });
  },

  markSaved(saved: SavedRequest) {
    const draft = { ...state.draft, savedRequestId: saved.id, collectionId: saved.collectionId, name: saved.name };
    publish({ ...state, draft, baseline: fingerprint(draft) });
  },

  /** The saved request was deleted elsewhere: keep the draft, forget the link. */
  detach(savedRequestId: string) {
    if (state.draft.savedRequestId !== savedRequestId) return;
    publish({ ...state, draft: { ...state.draft, savedRequestId: null }, baseline: '' });
  },

  setResponse(response: TesterResponse | null) {
    publish({ ...state, response });
  },

  openImport() {
    publish({ ...state, importOpen: true });
  },

  closeImport() {
    publish({ ...state, importOpen: false });
  },
};

export const isDirty = (current: TesterState) => fingerprint(current.draft) !== current.baseline;
