import { prisma } from '../config/database.js';
import type { SettingsPatch } from '../models/account.model.js';

const omitUserId = <T extends { userId: number }>({ userId: _userId, ...settings }: T) => settings;

export async function getSettings(userId: number) {
  const settings = await prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
  return omitUserId(settings);
}

export async function updateSettings(userId: number, patch: SettingsPatch) {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
  return omitUserId(settings);
}
