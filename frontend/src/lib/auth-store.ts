/**
 * The signed-in session, held in memory only.
 *
 * The short-lived access token never touches localStorage or sessionStorage, so
 * a script injected into the page cannot read a stored credential. The refresh
 * token lives in an httpOnly cookie that JavaScript cannot see at all; reloading
 * the page restores the session through /api/auth/refresh.
 */
import type { PublicUser, Session } from '@/types/models';

export type SessionEnd = 'signed-out' | 'expired';

export interface AuthSnapshot {
  accessToken: string | null;
  /** Epoch milliseconds when the access token stops being accepted. */
  expiresAt: number;
  user: PublicUser | null;
  /** Why the last session ended, for the sign-in screen and toasts. */
  ended: SessionEnd | null;
}

const EMPTY: AuthSnapshot = { accessToken: null, expiresAt: 0, user: null, ended: null };

let snapshot: AuthSnapshot = EMPTY;
const listeners = new Set<() => void>();

function publish(next: AuthSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export const authStore = {
  get: (): AuthSnapshot => snapshot,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setSession(session: Session) {
    publish({
      accessToken: session.accessToken,
      expiresAt: Date.now() + session.expiresIn * 1000,
      user: session.user,
      ended: null,
    });
  },

  setUser(user: PublicUser) {
    if (snapshot.user) publish({ ...snapshot, user });
  },

  clear(ended: SessionEnd | null = null) {
    publish({ ...EMPTY, ended });
  },
};
