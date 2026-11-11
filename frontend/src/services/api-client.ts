import { API_BASE_URL } from '@/config/app';
import { authStore } from '@/lib/auth-store';
import type { ApiEnvelope, ApiSuccess } from '@/types/api';
import type { PageMeta, Paginated, Session } from '@/types/models';

const DEFAULT_TIMEOUT_MS = 15_000;

/** Access-token failures that a refresh can fix. */
const REFRESHABLE = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN']);

/** Error raised for any failed API call, carrying the server's error code and request id. */
export class ApiError extends Error {
  /** HTTP status, or 0 when no response was received. */
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.requestId = options.requestId ?? null;
  }

  /** The API server could not be reached at all (stopped, offline, timed out). */
  get isUnreachable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'API_UNREACHABLE' || this.code === 'TIMEOUT';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Send without the access token and never try to refresh (sign-in, sign-up, refresh itself). */
  anonymous?: boolean;
}

type CallOptions = Omit<RequestOptions, 'method' | 'body'>;

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const { method = 'GET', body, headers, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: withTimeout(signal, timeoutMs),
    });
  } catch (error) {
    if (signal?.aborted) throw error; // cancelled by the caller — let it propagate
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(0, 'TIMEOUT', `The API did not answer within ${timeoutMs / 1000} seconds.`);
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the API server.');
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function unwrap<T>(response: Response): Promise<ApiSuccess<T>> {
  const requestId = response.headers.get('x-request-id');
  const envelope = (await readJson(response)) as ApiEnvelope<T> | null;

  if (!envelope || typeof envelope !== 'object' || !('success' in envelope)) {
    // The dev proxy answers 5xx with an empty body when the backend is not running.
    if (response.status >= 500)
      throw new ApiError(response.status, 'API_UNREACHABLE', 'The API server is not responding.', { requestId });
    throw new ApiError(response.status, 'INVALID_RESPONSE', `Unexpected ${response.status} response from the API.`, {
      requestId,
    });
  }
  if (!envelope.success) {
    const { code, message, details, requestId: errorRequestId } = envelope.error;
    throw new ApiError(response.status, code, message, { details, requestId: errorRequestId ?? requestId });
  }
  return envelope;
}

let refreshing: Promise<string | null> | null = null;

/**
 * Trade the httpOnly refresh cookie for a new access token. Concurrent callers
 * share one request, because every refresh rotates the cookie.
 * Resolves to the new token, or null when there is no valid session.
 */
export function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const { data } = await request<Session>('/auth/refresh', { method: 'POST', anonymous: true });
      authStore.setSession(data);
      return data.accessToken;
    } catch (error) {
      // An unreachable server says nothing about the session; anything else means it is gone.
      if (!(error instanceof ApiError && error.isUnreachable)) {
        authStore.clear(authStore.get().user ? 'expired' : null);
      }
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** One API call: attach the access token, refresh it once if it expired, unwrap the envelope. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const token = options.anonymous ? null : authStore.get().accessToken;
  try {
    return await unwrap<T>(await send(path, options, token));
  } catch (error) {
    const canRefresh =
      !options.anonymous &&
      token !== null &&
      error instanceof ApiError &&
      error.status === 401 &&
      REFRESHABLE.has(error.code);
    if (!canRefresh) throw error;
    const fresh = await refreshSession();
    if (!fresh) throw error;
    return unwrap<T>(await send(path, options, fresh));
  }
}

/** Call the Aether API and return `data`, throwing `ApiError` on failure. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await request<T>(path, options)).data;
}

type QueryValue = string | number | boolean | null | undefined;

/** Append defined, non-empty values as a query string. */
export function withQuery(path: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export const api = {
  get: <T>(path: string, options?: CallOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: CallOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: CallOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: CallOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: CallOptions) => apiRequest<T>(path, { ...options, method: 'DELETE' }),

  /** A paginated list: `data` plus the `meta` block (page, limit, total, …). */
  list: async <T, M extends PageMeta = PageMeta>(path: string, options?: CallOptions): Promise<Paginated<T, M>> => {
    const response = await request<T[]>(path, { ...options, method: 'GET' });
    return { items: response.data, meta: response.meta as unknown as M };
  },

  /** A plain JSON document without the envelope (the OpenAPI description). */
  document: async <T>(path: string, options?: CallOptions): Promise<T> => {
    const response = await send(path, { ...options, method: 'GET' }, null);
    const body = await readJson(response);
    if (!response.ok || body === null) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', `Could not load ${path} (${response.status}).`);
    }
    return body as T;
  },
};
