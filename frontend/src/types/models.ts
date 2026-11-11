/**
 * Shapes returned by the Aether API (dates arrive as ISO strings).
 * They mirror the DTO mappers in backend/src/models.
 */
import type { HttpMethod } from '@/lib/http';

export type Role = 'USER' | 'ADMIN';

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T, M extends PageMeta = PageMeta> {
  items: T[];
  meta: M;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number;
  category: string;
  imageUrl: string | null;
  rating: number;
  isActive: boolean;
  createdById: number | null;
  createdBy: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  name: string;
  count: number;
}

export type ThemeSetting = 'DARK' | 'LIGHT' | 'SYSTEM';

export interface UserSettings {
  theme: ThemeSetting;
  enable3dEffects: boolean;
  reducedMotion: boolean;
  requestTimeoutMs: number;
  notificationsEnabled: boolean;
  updatedAt: string;
}

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationMeta extends PageMeta {
  unreadCount: number;
}

// ─── API Tester ───────────────────────────────────────────────────────────────

export type BodyType = 'NONE' | 'JSON' | 'RAW';

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type RequestAuth =
  { type: 'NONE' } | { type: 'BEARER'; token: string } | { type: 'BASIC'; username: string; password: string };

/** The parts of a request that can be saved, executed or exported. */
export interface RequestSpec {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  queryParams: KeyValue[];
  bodyType: BodyType;
  body: string | null;
  auth: RequestAuth;
}

export interface SavedRequest extends RequestSpec {
  id: string;
  name: string;
  description: string | null;
  collectionId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedRequestInput extends RequestSpec {
  name: string;
  description: string | null;
  collectionId: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  requests: SavedRequest[];
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  variables: EnvironmentVariable[];
}

export interface EnvironmentInput {
  name: string;
  variables: Array<Omit<EnvironmentVariable, 'id'>>;
}

export interface HistorySummary {
  id: string;
  method: HttpMethod;
  url: string;
  statusCode: number | null;
  statusText: string | null;
  durationMs: number;
  responseSize: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface HistoryDetail extends HistorySummary {
  bodyType: BodyType;
  requestHeaders: Array<{ key: string; value: string }>;
  requestBody: string | null;
  responseHeaders: Array<{ key: string; value: string }>;
  responseBody: string | null;
}

export interface HeaderEntry {
  key: string;
  value: string;
}

export interface ExecuteInput extends RequestSpec {
  timeoutMs?: number;
  followRedirects: boolean;
  saveToHistory: boolean;
}

/** What the server-side executor reports for one request. */
export interface ExecuteResult {
  method: HttpMethod;
  requestUrl: string;
  finalUrl: string;
  /** 0 when no response arrived (DNS failure, refused connection, timeout). */
  status: number;
  statusText: string;
  ok: boolean;
  headers: HeaderEntry[];
  body: string;
  bodyEncoding: 'utf8' | 'base64';
  contentType: string | null;
  sizeBytes: number;
  headersSizeBytes: number;
  truncated: boolean;
  durationMs: number;
  ttfbMs: number | null;
  redirects: number;
  requestHeaders: HeaderEntry[];
  error: { code: string; message: string } | null;
  historyId: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type DashboardRange = '24h' | '7d' | '30d';
export type DashboardScope = 'me' | 'server';

export interface DashboardStats {
  scope: DashboardScope;
  range: DashboardRange;
  bucket: 'hour' | 'day';
  generatedAt: string;
  sampled: boolean;
  totals: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageResponseTimeMs: number;
  };
  timeline: Array<{
    bucket: string;
    total: number;
    successful: number;
    failed: number;
    averageResponseTimeMs: number;
  }>;
  statusCodes: Array<{ statusCode: string; count: number }>;
  methods: Array<{ method: string; count: number }>;
  topEndpoints: Array<{
    method: string;
    endpoint: string;
    count: number;
    failed: number;
    averageResponseTimeMs: number;
  }>;
  recentActivity: Array<{
    id: string;
    method: string;
    target: string;
    statusCode: number | null;
    durationMs: number;
    createdAt: string;
  }>;
}
