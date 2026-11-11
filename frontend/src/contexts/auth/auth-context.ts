import { createContext } from 'react';
import type { SessionEnd } from '@/lib/auth-store';
import type { LoginInput, RegisterInput } from '@/services/auth.service';
import type { PublicUser, Session } from '@/types/models';

/** `loading` only while the stored session is being restored on first load. */
export type AuthStatus = 'loading' | 'authenticated' | 'guest';

export interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  isAdmin: boolean;
  /** Why the previous session ended (shown on the sign-in screen). */
  ended: SessionEnd | null;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: RegisterInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
  /** Revoke every session of this account, on every device. */
  logoutEverywhere: () => Promise<number>;
  /** Adopt a session returned by another endpoint (password change). */
  applySession: (session: Session) => void;
  updateUser: (user: PublicUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
