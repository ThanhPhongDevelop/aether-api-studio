import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { toHistoryDetail, toHistorySummary, type HistoryListQuery } from '../models/workspace.model.js';
import { AppError } from '../utils/app-error.js';
import { pageMeta, toSkipTake } from '../utils/pagination.js';

/** Oldest entries beyond this are pruned automatically. */
export const MAX_HISTORY_PER_USER = 500;

function statusFilter(status: HistoryListQuery['status']): Prisma.RequestHistoryWhereInput {
  switch (status) {
    case 'success':
      return { statusCode: { gte: 200, lt: 400 } };
    case 'error':
      return { OR: [{ statusCode: null }, { statusCode: { gte: 400 } }] };
    case '2xx':
    case '3xx':
    case '4xx':
    case '5xx': {
      const base = Number(status[0]) * 100;
      return { statusCode: { gte: base, lt: base + 100 } };
    }
    default:
      return {};
  }
}

export async function listHistory(userId: number, query: HistoryListQuery) {
  const where: Prisma.RequestHistoryWhereInput = {
    userId,
    ...(query.search ? { url: { contains: query.search } } : {}),
    ...(query.method ? { method: query.method } : {}),
    ...statusFilter(query.status),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.requestHistory.count({ where }),
    prisma.requestHistory.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(query) }),
  ]);
  return { items: rows.map(toHistorySummary), meta: pageMeta(total, query) };
}

async function findEntry(userId: number, id: string) {
  const row = await prisma.requestHistory.findFirst({ where: { id, userId } });
  if (!row) throw AppError.notFound('History entry');
  return row;
}

export async function getHistoryEntry(userId: number, id: string) {
  return toHistoryDetail(await findEntry(userId, id));
}

export async function deleteHistoryEntry(userId: number, id: string) {
  await findEntry(userId, id);
  await prisma.requestHistory.delete({ where: { id } });
  return { id, deleted: true };
}

export async function clearHistory(userId: number) {
  const { count } = await prisma.requestHistory.deleteMany({ where: { userId } });
  return { deleted: count };
}

export async function recordHistory(userId: number, entry: Omit<Prisma.RequestHistoryUncheckedCreateInput, 'userId'>) {
  const row = await prisma.requestHistory.create({ data: { ...entry, userId } });
  const overflow = await prisma.requestHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: MAX_HISTORY_PER_USER,
    take: 1,
    select: { createdAt: true },
  });
  if (overflow[0]) {
    await prisma.requestHistory.deleteMany({ where: { userId, createdAt: { lte: overflow[0].createdAt } } });
  }
  return row.id;
}
