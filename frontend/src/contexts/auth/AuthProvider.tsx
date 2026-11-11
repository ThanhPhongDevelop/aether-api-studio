import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useToast } from '@/hooks/useToast';
import { authStore } from '@/lib/auth-store';
import { refreshSession } from '@/services/api-client';
import { authService, type LoginInput, type RegisterInput } from '@/services/auth.service';
import type { PublicUser, Session } from '@/types/models';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

/** Refresh this long before the access token expires, so requests never hit a 401 first. */
const REFRESH_LEAD_MS = 60_000;

type TabMessage = { type: 'login' } | { type: 'logout' };

/** Sign-in and sign-out in one tab are mirrored in the others. */
function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'function' ? new BroadcastChannel('aether-auth') : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const snapshot = useSyncExternalStore(authStore.subscribe, authStore.get);
  const [restored, setRestored] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);

  // Restore the session from the refresh cookie (shared by StrictMode's double effect).
  useEffect(() => {
    let active = true;
    void refreshSession().finally(() => active && setRestored(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const tabs = openChannel();
    channel.current = tabs;
    if (!tabs) return;
    tabs.onmessage = (event: MessageEvent<TabMessage>) => {
      if (event.data.type === 'logout') {
        authStore.clear('signed-out');
        queryClient.clear();
      } else if (event.data.type === 'login') {
        void refreshSession();
      }
    };
    return () => tabs.close();
  }, [queryClient]);

  // Renew quietly before the access token runs out.
  useEffect(() => {
    if (!snapshot.accessToken) return;
    const wait = Math.max(5_000, snapshot.expiresAt - Date.now() - REFRESH_LEAD_MS);
    const timer = window.setTimeout(() => void refreshSession(), wait);
    return () => window.clearTimeout(timer);
  }, [snapshot.accessToken, snapshot.expiresAt]);

  // Private data never outlives the session that fetched it.
  const userId = snapshot.user?.id ?? null;
  const previousUserId = useRef<number | null>(null);
  useEffect(() => {
    if (previousUserId.current !== null && previousUserId.current !== userId) queryClient.clear();
    previousUserId.current = userId;
  }, [userId, queryClient]);

  useEffect(() => {
    if (snapshot.ended === 'expired')
      toast.info('Your session expired', 'Sign in again to continue where you left off.');
  }, [snapshot.ended, toast]);

  const login = useCallback(async (input: LoginInput) => {
    const session = await authService.login(input);
    authStore.setSession(session);
    channel.current?.postMessage({ type: 'login' } satisfies TabMessage);
    return session.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await authService.register(input);
    authStore.setSession(session);
    channel.current?.postMessage({ type: 'login' } satisfies TabMessage);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Signing out locally still succeeds; the refresh token expires on its own.
    } finally {
      authStore.clear('signed-out');
      queryClient.clear();
      channel.current?.postMessage({ type: 'logout' } satisfies TabMessage);
    }
  }, [queryClient]);

  const logoutEverywhere = useCallback(async () => {
    const { revokedSessions } = await authService.logoutEverywhere();
    authStore.clear('signed-out');
    queryClient.clear();
    channel.current?.postMessage({ type: 'logout' } satisfies TabMessage);
    return revokedSessions;
  }, [queryClient]);

  const applySession = useCallback((session: Session) => authStore.setSession(session), []);
  const updateUser = useCallback((user: PublicUser) => authStore.setUser(user), []);

  let status: AuthStatus = 'loading';
  if (restored || snapshot.user) status = snapshot.user ? 'authenticated' : 'guest';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: snapshot.user,
      isAdmin: snapshot.user?.role === 'ADMIN',
      ended: snapshot.ended,
      login,
      register,
      logout,
      logoutEverywhere,
      applySession,
      updateUser,
    }),
    [status, snapshot.user, snapshot.ended, login, register, logout, logoutEverywhere, applySession, updateUser],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
