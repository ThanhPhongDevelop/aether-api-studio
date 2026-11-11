import { AnimatePresence, m } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { NotificationIcon } from '@/components/notifications/NotificationIcon';
import { Spinner } from '@/components/ui/Spinner';
import { useNotificationActions, useNotificationList, useUnreadCount } from '@/hooks/useNotifications';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import type { AppNotification } from '@/types/models';

/** Bell with the unread count; opens the latest notifications. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { data: unread = 0 } = useUnreadCount();
  const latest = useNotificationList({ page: 1, limit: 6 }, open);
  const { markRead, markAllRead } = useNotificationActions();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = (notification: AppNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.link) void navigate(notification.link);
  };

  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="relative grid size-8 place-items-center rounded-[0.7rem] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fail px-1 text-[0.625rem] font-semibold text-white tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            className="absolute top-full right-0 z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-[1rem] border border-line-strong bg-surface-strong shadow-[0_20px_50px_-20px_rgb(2_4_11/0.6)] backdrop-blur-2xl max-sm:-right-24"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-medium">Notifications</p>
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={unread === 0 || markAllRead.isPending}
                className="inline-flex items-center gap-1.5 rounded text-xs text-accent hover:underline disabled:text-ink-faint disabled:no-underline"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all as read
              </button>
            </div>
            <div className="max-h-[22rem] overflow-y-auto">
              {latest.isPending ? (
                <div className="grid place-items-center py-10 text-ink-faint">
                  <Spinner className="size-5" />
                </div>
              ) : latest.data && latest.data.items.length > 0 ? (
                <ul className="divide-y divide-line">
                  {latest.data.items.map((notification) => (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-line/60"
                      >
                        <NotificationIcon type={notification.type} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-[0.8125rem]',
                                notification.readAt ? 'text-ink-muted' : 'font-medium text-ink',
                              )}
                            >
                              {notification.title}
                            </span>
                            <span className="shrink-0 text-[0.6875rem] text-ink-faint">
                              {formatRelative(notification.createdAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">
                            {notification.message}
                          </span>
                        </span>
                        {notification.readAt ? null : (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-10 text-center text-[0.8125rem] text-ink-faint">You're all caught up.</p>
              )}
            </div>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-2.5 text-center text-[0.8125rem] text-ink-muted transition-colors hover:bg-line/60 hover:text-ink"
            >
              View all notifications
            </Link>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
