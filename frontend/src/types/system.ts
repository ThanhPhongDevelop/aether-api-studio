/** Mirrors backend/src/models/system.model.ts. */

export type ServiceStatus = 'up' | 'down';
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
  checks: { database: DatabaseCheck };
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
