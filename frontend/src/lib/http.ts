/**
 * HTTP semantics shared by every screen: status classes and methods map to the
 * same colours everywhere (status page, live probe, API tester, dashboard).
 */

export type Tone = 'ok' | 'redirect' | 'warn' | 'fail' | 'neutral';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export function toneForStatus(status: number): Tone {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'warn';
  if (status >= 500 || status === 0) return 'fail';
  return 'neutral';
}

/** Full class strings (not interpolated) so Tailwind can detect them. */
export const TONE_CLASSES: Record<Tone, { text: string; soft: string; dot: string; glow: string }> = {
  ok: { text: 'text-ok', soft: 'bg-ok/12 text-ok', dot: 'bg-ok', glow: 'shadow-[0_0_12px_var(--ok)]' },
  redirect: {
    text: 'text-redirect',
    soft: 'bg-redirect/12 text-redirect',
    dot: 'bg-redirect',
    glow: 'shadow-[0_0_12px_var(--redirect)]',
  },
  warn: { text: 'text-warn', soft: 'bg-warn/14 text-warn', dot: 'bg-warn', glow: 'shadow-[0_0_12px_var(--warn)]' },
  fail: { text: 'text-fail', soft: 'bg-fail/12 text-fail', dot: 'bg-fail', glow: 'shadow-[0_0_12px_var(--fail)]' },
  neutral: { text: 'text-ink-muted', soft: 'bg-line text-ink-muted', dot: 'bg-ink-faint', glow: '' },
};

/** Theme-independent colours for WebGL materials. */
export const TONE_HEX: Record<Tone, string> = {
  ok: '#2ee6a6',
  redirect: '#7aa2ff',
  warn: '#ffb547',
  fail: '#ff5c7a',
  neutral: '#9aa3c7',
};

export const METHOD_CLASSES: Record<HttpMethod, string> = {
  GET: 'bg-ok/12 text-ok',
  POST: 'bg-warn/14 text-warn',
  PUT: 'bg-redirect/12 text-redirect',
  PATCH: 'bg-flux/14 text-flux',
  DELETE: 'bg-fail/12 text-fail',
  HEAD: 'bg-line text-ink-muted',
  OPTIONS: 'bg-line text-ink-muted',
};

/** Method colour as text only (the method picker in the request bar). */
export const METHOD_TEXT: Record<HttpMethod, string> = {
  GET: 'text-ok',
  POST: 'text-warn',
  PUT: 'text-redirect',
  PATCH: 'text-flux',
  DELETE: 'text-fail',
  HEAD: 'text-ink-muted',
  OPTIONS: 'text-ink-muted',
};

export const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const isHttpMethod = (value: string): value is HttpMethod => value in METHOD_CLASSES;
