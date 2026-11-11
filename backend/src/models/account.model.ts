import { z } from 'zod';
import { paginationFields } from '../utils/pagination.js';

export const THEMES = ['DARK', 'LIGHT', 'SYSTEM'] as const;

export const updateSettingsBody = z
  .object({
    theme: z.enum(THEMES),
    enable3dEffects: z.boolean(),
    reducedMotion: z.boolean(),
    requestTimeoutMs: z.number().int().min(1000, 'must be at least 1000 ms').max(120_000, 'must be at most 120000 ms'),
    notificationsEnabled: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one setting to update');
export type SettingsPatch = z.infer<typeof updateSettingsBody>;

export const notificationListQuery = z.object({
  ...paginationFields(20),
  unread: z.stringbool().optional(),
});
export type NotificationListQuery = z.infer<typeof notificationListQuery>;
