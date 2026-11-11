import type { Request, Response } from 'express';
import type {
  CollectionInput,
  CollectionPatch,
  EnvironmentInput,
  HistoryListQuery,
  SavedRequestInput,
} from '../models/workspace.model.js';
import * as collectionService from '../services/collection.service.js';
import * as environmentService from '../services/environment.service.js';
import * as historyService from '../services/history.service.js';
import { sendSuccess } from '../utils/http-response.js';
import { requireUser, validated } from '../utils/request.js';

const owner = (req: Request) => requireUser(req).id;
const idOf = (res: Response) => validated<{ id: string }>(res, 'params').id;

// Collections
export async function listCollections(req: Request, res: Response) {
  sendSuccess(res, await collectionService.listCollections(owner(req)));
}
export async function getCollection(req: Request, res: Response) {
  sendSuccess(res, await collectionService.getCollection(owner(req), idOf(res)));
}
export async function createCollection(req: Request, res: Response) {
  const collection = await collectionService.createCollection(owner(req), validated<CollectionInput>(res, 'body'));
  sendSuccess(res, collection, { status: 201 });
}
export async function updateCollection(req: Request, res: Response) {
  sendSuccess(
    res,
    await collectionService.updateCollection(owner(req), idOf(res), validated<CollectionPatch>(res, 'body')),
  );
}
export async function deleteCollection(req: Request, res: Response) {
  sendSuccess(res, await collectionService.deleteCollection(owner(req), idOf(res)));
}

// Saved requests
export async function listSavedRequests(req: Request, res: Response) {
  const { collectionId } = validated<{ collectionId?: string }>(res, 'query');
  sendSuccess(res, await collectionService.listSavedRequests(owner(req), collectionId));
}
export async function getSavedRequest(req: Request, res: Response) {
  sendSuccess(res, await collectionService.getSavedRequest(owner(req), idOf(res)));
}
export async function createSavedRequest(req: Request, res: Response) {
  const saved = await collectionService.createSavedRequest(owner(req), validated<SavedRequestInput>(res, 'body'));
  sendSuccess(res, saved, { status: 201 });
}
export async function replaceSavedRequest(req: Request, res: Response) {
  sendSuccess(
    res,
    await collectionService.replaceSavedRequest(owner(req), idOf(res), validated<SavedRequestInput>(res, 'body')),
  );
}
export async function deleteSavedRequest(req: Request, res: Response) {
  sendSuccess(res, await collectionService.deleteSavedRequest(owner(req), idOf(res)));
}

// History
export async function listHistory(req: Request, res: Response) {
  const { items, meta } = await historyService.listHistory(owner(req), validated<HistoryListQuery>(res, 'query'));
  sendSuccess(res, items, { meta: { ...meta } });
}
export async function getHistoryEntry(req: Request, res: Response) {
  sendSuccess(res, await historyService.getHistoryEntry(owner(req), idOf(res)));
}
export async function deleteHistoryEntry(req: Request, res: Response) {
  sendSuccess(res, await historyService.deleteHistoryEntry(owner(req), idOf(res)));
}
export async function clearHistory(req: Request, res: Response) {
  sendSuccess(res, await historyService.clearHistory(owner(req)));
}

// Environments
export async function listEnvironments(req: Request, res: Response) {
  sendSuccess(res, await environmentService.listEnvironments(owner(req)));
}
export async function createEnvironment(req: Request, res: Response) {
  const environment = await environmentService.createEnvironment(owner(req), validated<EnvironmentInput>(res, 'body'));
  sendSuccess(res, environment, { status: 201 });
}
export async function replaceEnvironment(req: Request, res: Response) {
  sendSuccess(
    res,
    await environmentService.replaceEnvironment(owner(req), idOf(res), validated<EnvironmentInput>(res, 'body')),
  );
}
export async function deleteEnvironment(req: Request, res: Response) {
  sendSuccess(res, await environmentService.deleteEnvironment(owner(req), idOf(res)));
}
export async function activateEnvironment(req: Request, res: Response) {
  sendSuccess(res, await environmentService.activateEnvironment(owner(req), idOf(res)));
}
export async function deactivateEnvironments(req: Request, res: Response) {
  sendSuccess(res, await environmentService.deactivateEnvironments(owner(req)));
}
