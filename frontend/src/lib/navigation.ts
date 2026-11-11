/** Only same-site paths are accepted as a post-login destination (no open redirects). */
export function safeNext(value: string | null, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}

/** "/login?next=…" for the current location. */
export const loginPath = (pathname: string, search = '') => `/login?next=${encodeURIComponent(pathname + search)}`;
