import { prisma } from '../config/database.js';
import type { NotificationType } from '../generated/prisma/client.js';
import type { NotificationListQuery } from '../models/account.model.js';
import { AppError } from '../utils/app-error.js';
import { pageMeta, toSkipTake } from '../utils/pagination.js';

export interface NewNotification {
  type?: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}

/**
 * Add a notification to a user's inbox. People who turned notifications off in
 * Settings still receive security warnings (lockouts, password changes,
 * WARNING/ERROR types); informational ones are skipped. Returns null when skipped.
 */
export async function notify(userId: number, notification: NewNotification) {
  const type = notification.type ?? 'INFO';
  if (type === 'INFO' || type === 'SUCCESS') {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { notificationsEnabled: true },
    });
    if (settings && !settings.notificationsEnabled) return null;
  }
  return prisma.notification.create({
    data: {
      userId,
      type,
      title: notification.title,
      message: notification.message,
      link: notification.link ?? null,
    },
  });
}

export async function listNotifications(userId: number, query: NotificationListQuery) {
  const where = {
    userId,
    ...(query.unread === true ? { readAt: null } : query.unread === false ? { readAt: { not: null } } : {}),
  };
  const [total, unreadCount, items] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(query) }),
  ]);
  return { items, meta: { ...pageMeta(total, query), unreadCount } };
}

export function unreadCount(userId: number) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

async function findOwned(userId: number, id: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw AppError.notFound('Notification');
  return notification;
}

export async function markRead(userId: number, id: string) {
  const notification = await findOwned(userId, id);
  if (notification.readAt) return notification;
  return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: number) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: count };
}

export async function deleteNotification(userId: number, id: string) {
  await findOwned(userId, id);
  await prisma.notification.delete({ where: { id } });
  return { id, deleted: true };
}
