import { prisma } from '../config/database.js';
import {
  authToColumns,
  toCollectionDto,
  toSavedRequestDto,
  type CollectionInput,
  type CollectionPatch,
  type SavedRequestInput,
} from '../models/workspace.model.js';
import { AppError } from '../utils/app-error.js';

const requestOrder = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];
const withRequests = { requests: { orderBy: requestOrder } };

// ─── Collections ────────────────────────────────────────────────────────────

export async function listCollections(ownerId: number) {
  const rows = await prisma.collection.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'asc' },
    include: withRequests,
  });
  return rows.map(toCollectionDto);
}

async function findCollection(ownerId: number, id: string) {
  const collection = await prisma.collection.findFirst({ where: { id, ownerId }, include: withRequests });
  if (!collection) throw AppError.notFound('Collection');
  return collection;
}

async function assertCollectionNameFree(ownerId: number, name: string, exceptId?: string) {
  const taken = await prisma.collection.findFirst({
    where: { ownerId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw AppError.conflict('You already have a collection with this name', { fields: ['name'] });
}

export async function getCollection(ownerId: number, id: string) {
  return toCollectionDto(await findCollection(ownerId, id));
}

export async function createCollection(ownerId: number, input: CollectionInput) {
  await assertCollectionNameFree(ownerId, input.name);
  const row = await prisma.collection.create({ data: { ...input, ownerId }, include: withRequests });
  return toCollectionDto(row);
}

export async function updateCollection(ownerId: number, id: string, patch: CollectionPatch) {
  await findCollection(ownerId, id);
  if (patch.name) await assertCollectionNameFree(ownerId, patch.name, id);
  const row = await prisma.collection.update({ where: { id }, data: patch, include: withRequests });
  return toCollectionDto(row);
}

export async function deleteCollection(ownerId: number, id: string) {
  await findCollection(ownerId, id);
  await prisma.collection.delete({ where: { id } });
  return { id, deleted: true };
}

// ─── Saved requests ─────────────────────────────────────────────────────────

async function assertCollectionOwned(ownerId: number, collectionId: string | null) {
  if (!collectionId) return;
  const owned = await prisma.collection.findFirst({ where: { id: collectionId, ownerId }, select: { id: true } });
  if (!owned) {
    throw AppError.validation([{ path: 'body.collectionId', message: 'collection not found', code: 'not_found' }]);
  }
}

function toColumns(input: SavedRequestInput) {
  const { auth, ...fields } = input;
  return { ...fields, ...authToColumns(auth) };
}

export async function listSavedRequests(ownerId: number, collectionId?: string) {
  const rows = await prisma.savedRequest.findMany({
    where: { ownerId, ...(collectionId ? { collectionId } : {}) },
    orderBy: requestOrder,
  });
  return rows.map(toSavedRequestDto);
}

async function findSavedRequest(ownerId: number, id: string) {
  const row = await prisma.savedRequest.findFirst({ where: { id, ownerId } });
  if (!row) throw AppError.notFound('Saved request');
  return row;
}

export async function getSavedRequest(ownerId: number, id: string) {
  return toSavedRequestDto(await findSavedRequest(ownerId, id));
}

export async function createSavedRequest(ownerId: number, input: SavedRequestInput) {
  await assertCollectionOwned(ownerId, input.collectionId);
  const sortOrder = await prisma.savedRequest.count({ where: { ownerId, collectionId: input.collectionId } });
  const row = await prisma.savedRequest.create({ data: { ...toColumns(input), ownerId, sortOrder } });
  return toSavedRequestDto(row);
}

export async function replaceSavedRequest(ownerId: number, id: string, input: SavedRequestInput) {
  await findSavedRequest(ownerId, id);
  await assertCollectionOwned(ownerId, input.collectionId);
  const row = await prisma.savedRequest.update({ where: { id }, data: toColumns(input) });
  return toSavedRequestDto(row);
}

export async function deleteSavedRequest(ownerId: number, id: string) {
  await findSavedRequest(ownerId, id);
  await prisma.savedRequest.delete({ where: { id } });
  return { id, deleted: true };
}
