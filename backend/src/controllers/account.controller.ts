import type { Request, Response } from 'express';
import type { NotificationListQuery, SettingsPatch } from '../models/account.model.js';
import * as notificationService from '../services/notification.service.js';
import * as settingsService from '../services/settings.service.js';
import { sendSuccess } from '../utils/http-response.js';
import { requireUser, validated } from '../utils/request.js';

const stringId = (res: Response) => validated<{ id: string }>(res, 'params').id;

export async function getSettings(req: Request, res: Response) {
  sendSuccess(res, await settingsService.getSettings(requireUser(req).id));
}

export async function updateSettings(req: Request, res: Response) {
  sendSuccess(res, await settingsService.updateSettings(requireUser(req).id, validated<SettingsPatch>(res, 'body')));
}

export async function listNotifications(req: Request, res: Response) {
  const { items, meta } = await notificationService.listNotifications(
    requireUser(req).id,
    validated<NotificationListQuery>(res, 'query'),
  );
  sendSuccess(res, items, { meta: { ...meta } });
}

export async function unreadCount(req: Request, res: Response) {
  sendSuccess(res, { unreadCount: await notificationService.unreadCount(requireUser(req).id) });
}

export async function markRead(req: Request, res: Response) {
  sendSuccess(res, await notificationService.markRead(requireUser(req).id, stringId(res)));
}

export async function markAllRead(req: Request, res: Response) {
  sendSuccess(res, await notificationService.markAllRead(requireUser(req).id));
}

export async function deleteNotification(req: Request, res: Response) {
  sendSuccess(res, await notificationService.deleteNotification(requireUser(req).id, stringId(res)));
}
