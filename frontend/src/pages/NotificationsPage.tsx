import { Bell, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { NotificationIcon } from '@/components/notifications/NotificationIcon';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/app';
import { useNotificationActions, useNotificationList } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/form-errors';
import { formatDateTime, formatRelative } from '@/lib/format';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const list = useNotificationList({ page, limit: 15, unread: filter === 'unread' ? true : undefined });
  const { markRead, markAllRead, remove } = useNotificationActions();
  const toast = useToast();
  const unread = list.data?.meta.unreadCount ?? 0;

  return (
    <>
      <title>{pageTitle('Notifications')}</title>
      <PageHeader
        title="Notifications"
        description="Account events: welcome messages, security warnings and changes made to your account."
        actions={
          <Button
            variant="secondary"
            icon={<CheckCheck />}
            disabled={unread === 0}
            loading={markAllRead.isPending}
            onClick={() =>
              markAllRead.mutate(undefined, {
                onSuccess: ({ updated }) =>
                  toast.success('All caught up', `${updated} notification${updated === 1 ? '' : 's'} marked as read.`),
                onError: (error) => toast.error('Not marked as read', errorMessage(error)),
              })
            }
          >
            Mark all as read
          </Button>
        }
      />

      <div className="mb-5 flex items-center gap-3">
        <SegmentedControl
          label="Show"
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: unread ? `Unread (${unread})` : 'Unread' },
          ]}
        />
      </div>

      {list.isError && !list.data ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : (
        <div
          className={cn(
            'glass max-w-3xl overflow-hidden rounded-[1.25rem] transition-opacity',
            list.isPlaceholderData && 'opacity-60',
          )}
        >
          {list.isPending ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-14" />
              ))}
            </div>
          ) : list.data.items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              description={filter === 'unread' ? 'Everything has been read.' : 'Account events will appear here.'}
            />
          ) : (
            <ul className="divide-y divide-line">
              {list.data.items.map((notification) => (
                <li
                  key={notification.id}
                  className={cn('flex gap-3.5 px-5 py-4', !notification.readAt && 'bg-accent/[0.04]')}
                >
                  <NotificationIcon type={notification.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className={cn('text-sm', notification.readAt ? 'text-ink-muted' : 'font-medium text-ink')}>
                        {notification.readAt ? null : (
                          <span
                            className="mr-2 inline-block size-2 rounded-full bg-accent align-middle"
                            aria-label="Unread"
                          />
                        )}
                        {notification.title}
                      </p>
                      <time
                        dateTime={notification.createdAt}
                        title={formatDateTime(notification.createdAt)}
                        className="text-xs text-ink-faint"
                      >
                        {formatRelative(notification.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-[0.8125rem] text-ink-muted">{notification.message}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {notification.link ? (
                        <Link
                          to={notification.link}
                          onClick={() => !notification.readAt && markRead.mutate(notification.id)}
                          className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-accent hover:bg-accent/10"
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                          Open
                        </Link>
                      ) : null}
                      {notification.readAt ? null : (
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<CheckCheck />}
                          onClick={() => markRead.mutate(notification.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<Trash2 />}
                        className="hover:bg-fail/10 hover:text-fail"
                        onClick={() =>
                          remove.mutate(notification.id, {
                            onSuccess: () => toast.success('Notification deleted'),
                            onError: (error) => toast.error('Not deleted', errorMessage(error)),
                          })
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {list.data && list.data.meta.total > 0 ? (
            <Pagination
              meta={list.data.meta}
              onPageChange={setPage}
              noun="notifications"
              className="border-t border-line px-5 py-3"
            />
          ) : null}
        </div>
      )}
    </>
  );
}
