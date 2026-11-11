/** The subset of OpenAPI 3.1 that the Aether API describes itself with (see backend/src/docs/openapi.ts). */

export type AccessLevel = 'public' | 'user' | 'admin' | 'optional';

export interface OpenApiSchema {
  type?: string | string[];
  format?: string;
  description?: string;
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  $ref?: string;
}

export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
  example?: unknown;
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema;
  example?: unknown;
  examples?: Record<string, { summary?: string; value: unknown }>;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: { required?: boolean; description?: string; content?: Record<string, OpenApiMediaType> };
  responses?: Record<string, { description?: string; content?: Record<string, OpenApiMediaType> }>;
  security?: Array<Record<string, string[]>>;
  'x-access'?: AccessLevel;
}

export type OpenApiPathItem = Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', OpenApiOperation>>;

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, OpenApiPathItem>;
}
