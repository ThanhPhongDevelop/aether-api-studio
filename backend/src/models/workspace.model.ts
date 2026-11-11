import { z } from 'zod';
import {
  Prisma,
  type AuthType,
  type Collection,
  type Environment,
  type EnvironmentVariable,
  type RequestHistory,
  type SavedRequest,
} from '../generated/prisma/client.js';
import { paginationFields } from '../utils/pagination.js';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export const BODY_TYPES = ['NONE', 'JSON', 'RAW'] as const;

export const keyValueSchema = z.object({
  key: z.string().max(256),
  value: z.string().max(8192),
  enabled: z.boolean().default(true),
});
export type KeyValue = z.infer<typeof keyValueSchema>;
const keyValueList = z.array(keyValueSchema).max(100);

export const requestAuthSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NONE') }),
  z.object({ type: z.literal('BEARER'), token: z.string().max(8192) }),
  z.object({ type: z.literal('BASIC'), username: z.string().max(256), password: z.string().max(1024) }),
]);
export type RequestAuth = z.infer<typeof requestAuthSchema>;

const requestFields = {
  method: z.enum(HTTP_METHODS),
  url: z.string('is required').trim().min(1, 'is required').max(8192),
  headers: keyValueList.default([]),
  queryParams: keyValueList.default([]),
  bodyType: z.enum(BODY_TYPES).default('NONE'),
  body: z.string().max(1_000_000).nullable().default(null),
  auth: requestAuthSchema.default({ type: 'NONE' }),
};

export const executeBody = z.object({
  ...requestFields,
  timeoutMs: z.number().int().min(100).max(120_000).optional(),
  followRedirects: z.boolean().default(true),
  saveToHistory: z.boolean().default(true),
});
export type ExecuteInput = z.infer<typeof executeBody>;

export const savedRequestBody = z.object({
  ...requestFields,
  name: z.string('is required').trim().min(1, 'is required').max(120),
  description: z.string().trim().max(500).nullable().default(null),
  collectionId: z.string().trim().min(1).max(64).nullable().default(null),
});
export type SavedRequestInput = z.infer<typeof savedRequestBody>;

export const savedRequestListQuery = z.object({ collectionId: z.string().trim().min(1).max(64).optional() });

const collectionName = z.string('is required').trim().min(1, 'is required').max(80);
const collectionDescription = z.string().trim().max(500).nullable();
export const collectionBody = z.object({ name: collectionName, description: collectionDescription.default(null) });
export type CollectionInput = z.infer<typeof collectionBody>;
export const collectionPatch = z
  .object({ name: collectionName, description: collectionDescription })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export type CollectionPatch = z.infer<typeof collectionPatch>;

const variableSchema = z.object({
  key: z
    .string('is required')
    .trim()
    .min(1, 'is required')
    .max(128)
    .regex(/^[A-Za-z0-9_.-]+$/, 'may only contain letters, numbers, ".", "-" and "_"'),
  value: z.string().max(8192).default(''),
  isSecret: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const environmentBody = z.object({
  name: z.string('is required').trim().min(1, 'is required').max(60),
  variables: z
    .array(variableSchema)
    .max(200)
    .default([])
    .superRefine((variables, ctx) => {
      const seen = new Set<string>();
      variables.forEach((variable, index) => {
        if (seen.has(variable.key)) {
          ctx.addIssue({ code: 'custom', path: [index, 'key'], message: `duplicate variable "${variable.key}"` });
        }
        seen.add(variable.key);
      });
    }),
});
export type EnvironmentInput = z.infer<typeof environmentBody>;

export const historyListQuery = z.object({
  ...paginationFields(20),
  search: z.string().trim().max(200).optional(),
  method: z.enum(HTTP_METHODS).optional(),
  status: z.enum(['success', 'error', '2xx', '3xx', '4xx', '5xx']).optional(),
});
export type HistoryListQuery = z.infer<typeof historyListQuery>;

export const dashboardQuery = z.object({
  scope: z.enum(['me', 'server']).default('me'),
  range: z.enum(['24h', '7d', '30d']).default('7d'),
  /** Minutes to add to UTC for the viewer's local time (Vietnam = 420). */
  tzOffset: z.coerce.number().int().min(-840).max(840).default(0),
});
export type DashboardQuery = z.infer<typeof dashboardQuery>;

// ─── Mapping between API shapes and database rows ───────────────────────────

const asKeyValues = (value: Prisma.JsonValue | null): KeyValue[] => (Array.isArray(value) ? (value as KeyValue[]) : []);

export function toRequestAuth(type: AuthType, value: Prisma.JsonValue | null): RequestAuth {
  const data = (value ?? {}) as Record<string, unknown>;
  if (type === 'BEARER') return { type, token: String(data.token ?? '') };
  if (type === 'BASIC') return { type, username: String(data.username ?? ''), password: String(data.password ?? '') };
  return { type: 'NONE' };
}

export function authToColumns(auth: RequestAuth) {
  const { type, ...credentials } = auth;
  return {
    authType: type,
    auth: type === 'NONE' ? Prisma.DbNull : (credentials as Prisma.InputJsonValue),
  };
}

export function toSavedRequestDto(row: SavedRequest) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    method: row.method,
    url: row.url,
    headers: asKeyValues(row.headers),
    queryParams: asKeyValues(row.queryParams),
    bodyType: row.bodyType,
    body: row.body,
    auth: toRequestAuth(row.authType, row.auth),
    collectionId: row.collectionId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toCollectionDto(row: Collection & { requests: SavedRequest[] }) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    requests: row.requests.map(toSavedRequestDto),
  };
}

export function toEnvironmentDto(row: Environment & { variables: EnvironmentVariable[] }) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    variables: row.variables.map(({ id, key, value, isSecret, enabled }) => ({ id, key, value, isSecret, enabled })),
  };
}

export function toHistorySummary(row: RequestHistory) {
  return {
    id: row.id,
    method: row.method,
    url: row.url,
    statusCode: row.statusCode,
    statusText: row.statusText,
    durationMs: row.durationMs,
    responseSize: row.responseSize,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

export function toHistoryDetail(row: RequestHistory) {
  return {
    ...toHistorySummary(row),
    bodyType: row.bodyType,
    requestHeaders: asKeyValues(row.requestHeaders),
    requestBody: row.requestBody,
    responseHeaders: asKeyValues(row.responseHeaders),
    responseBody: row.responseBody,
  };
}
