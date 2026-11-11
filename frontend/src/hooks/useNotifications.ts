import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/account.service';
import { useAuth } from './useAuth';

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  list: (query: { page: number; limit: number; unread?: boolean }) => ['notifications', 'list', query] as const,
};

/** Unread count for the bell, checked every 30 seconds while signed in. */
export function useUnreadCount() {
  const { status } = useAuth();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => notificationService.unreadCount(signal),
    enabled: status === 'authenticated',
    refetchInterval: 30_000,
    select: (data) => data.unreadCount,
  });
}

export function useNotificationList(query: { page: number; limit: number; unread?: boolean }, enabled = true) {
  const { status } = useAuth();
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: ({ signal }) => notificationService.list(query, signal),
    enabled: enabled && status === 'authenticated',
    placeholderData: keepPreviousData,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });

  return {
    markRead: useMutation({ mutationFn: notificationService.markRead, onSuccess: refresh }),
    markAllRead: useMutation({ mutationFn: notificationService.markAllRead, onSuccess: refresh }),
    remove: useMutation({ mutationFn: notificationService.remove, onSuccess: refresh }),
  };
}
