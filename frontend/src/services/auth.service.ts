import type { PublicUser, Session } from '@/types/models';
import { api } from './api-client';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export interface ProfileInput {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const authService = {
  login: (input: LoginInput) => api.post<Session>('/auth/login', input, { anonymous: true }),
  register: (input: RegisterInput) => api.post<Session>('/auth/register', input, { anonymous: true }),
  /** Revokes this browser's refresh token (read from the httpOnly cookie) and clears the cookie. */
  logout: () => api.post<{ signedOut: boolean }>('/auth/logout', undefined, { anonymous: true }),
  logoutEverywhere: () => api.post<{ revokedSessions: number }>('/auth/logout-all'),
  getProfile: () => api.get<PublicUser>('/auth/profile'),
  updateProfile: (input: ProfileInput) => api.patch<PublicUser>('/auth/profile', input),
  changePassword: (input: ChangePasswordInput) => api.post<Session>('/auth/change-password', input),
};
