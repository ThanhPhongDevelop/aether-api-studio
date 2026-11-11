import type { AppNotification, NotificationMeta, UserSettings } from '@/types/models';
import { api, withQuery } from './api-client';

export type SettingsInput = Partial<Omit<UserSettings, 'updatedAt'>>;

export const settingsService = {
  get: (signal?: AbortSignal) => api.get<UserSettings>('/settings', { signal }),
  update: (input: SettingsInput) => api.patch<UserSettings>('/settings', input),
};

export const notificationService = {
  list: (query: { page?: number; limit?: number; unread?: boolean }, signal?: AbortSignal) =>
    api.list<AppNotification, NotificationMeta>(withQuery('/notifications', { ...query }), { signal }),
  unreadCount: (signal?: AbortSignal) => api.get<{ unreadCount: number }>('/notifications/unread-count', { signal }),
  markRead: (id: string) => api.patch<AppNotification>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ updated: number }>('/notifications/read-all'),
  remove: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/notifications/${id}`),
};
