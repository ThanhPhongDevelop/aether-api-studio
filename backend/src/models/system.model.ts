/**
 * Response contracts of the system endpoints (`/api`, `/api/health`, `/api/status`).
 * The frontend mirrors these in frontend/src/types/system.ts.
 */

export type ServiceStatus = 'up' | 'down';

/**
 * - `ok`: every dependency is healthy
 * - `degraded`: reachable but slow, or the 5xx rate over the window is high
 * - `down`: a critical dependency (the database) is unreachable
 */
export type OverallStatus = 'ok' | 'degraded' | 'down';

export interface DatabaseCheck {
  status: ServiceStatus;
  latencyMs: number;
  error?: string;
}

export interface HealthReport {
  status: OverallStatus;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DatabaseCheck;
  };
}

export interface StatusCodeCount {
  statusCode: number;
  count: number;
}

export interface RouteUsage {
  method: string;
  route: string;
  count: number;
  averageResponseTimeMs: number;
}

export interface TrafficStats {
  windowHours: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  serverErrors: number;
  /** Percentage (0–100) of requests answered with a status below 400. */
  successRate: number;
  averageResponseTimeMs: number;
  maxResponseTimeMs: number;
  lastRequestAt: string | null;
  statusCodes: StatusCodeCount[];
  topRoutes: RouteUsage[];
}

export interface RecordCounts {
  users: number;
  products: number;
  collections: number;
  savedRequests: number;
  environments: number;
  requestHistory: number;
}

export interface StatusReport {
  status: OverallStatus;
  timestamp: string;
  service: {
    name: string;
    version: string;
    environment: string;
    startedAt: string;
    uptimeSeconds: number;
  };
  runtime: {
    node: string;
    platform: string;
    arch: string;
    cpuCount: number;
    loadAverage: number[];
    memory: {
      rssBytes: number;
      heapUsedBytes: number;
      heapTotalBytes: number;
      systemTotalBytes: number;
      systemFreeBytes: number;
    };
  };
  database: DatabaseCheck & {
    provider: 'sqlite';
    records: RecordCounts | null;
  };
  metricsEnabled: boolean;
  traffic: TrafficStats | null;
}

export interface ApiEndpointSummary {
  method: string;
  path: string;
  description: string;
}

export interface ApiIndex {
  name: string;
  version: string;
  environment: string;
  timestamp: string;
  endpoints: ApiEndpointSummary[];
}
