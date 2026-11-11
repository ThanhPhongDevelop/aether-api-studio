import { API_BASE_URL } from '@/config/app';
import { STATUS_TEXT, type HttpMethod } from '@/lib/http';

/** Everything a person inspects after sending a request, measured in the browser. */
export interface ProbeResult {
  method: HttpMethod;
  url: string;
  /** HTTP status, or 0 when no response was received. */
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  requestId: string | null;
  contentType: string | null;
  /** Response body; JSON is pretty-printed. */
  body: string;
  /** Network-level failure (no HTTP response at all). */
  error: string | null;
  receivedAt: string;
}

function prettify(text: string, contentType: string | null): string {
  if (!contentType?.includes('json')) return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/**
 * Send a real HTTP request to the Aether API and report status, timing and size.
 * Unlike `apiRequest`, HTTP error statuses are results, not exceptions — this is
 * the browser-side core the API Tester builds on.
 */
export async function sendProbe(method: HttpMethod, path: string, timeoutMs = 10_000): Promise<ProbeResult> {
  const url = `${API_BASE_URL}${path}`;
  const started = performance.now();

  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const contentType = response.headers.get('content-type');
    return {
      method,
      url,
      status: response.status,
      statusText: response.statusText || STATUS_TEXT[response.status] || '',
      durationMs: performance.now() - started,
      sizeBytes: new TextEncoder().encode(text).byteLength,
      requestId: response.headers.get('x-request-id'),
      contentType,
      body: prettify(text, contentType),
      error: null,
      receivedAt: new Date().toISOString(),
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return {
      method,
      url,
      status: 0,
      statusText: timedOut ? 'Timed out' : 'No response',
      durationMs: performance.now() - started,
      sizeBytes: 0,
      requestId: null,
      contentType: null,
      body: '',
      error: timedOut ? `No answer within ${timeoutMs / 1000} seconds.` : 'The request never reached the API server.',
      receivedAt: new Date().toISOString(),
    };
  }
}
