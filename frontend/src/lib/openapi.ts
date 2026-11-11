/** Reading the API's own OpenAPI document: listing operations and turning one into a tester request. */
import type { HttpMethod } from './http';
import type { LoadableRequest } from './tester-store';
import type { AccessLevel, OpenApiDocument, OpenApiMediaType, OpenApiOperation } from '@/types/openapi';

export interface DocOperation {
  id: string;
  method: Uppercase<'get' | 'post' | 'put' | 'patch' | 'delete'>;
  path: string;
  tag: string;
  access: AccessLevel;
  operation: OpenApiOperation;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export function listOperations(document: OpenApiDocument): DocOperation[] {
  const operations: DocOperation[] = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation) continue;
      operations.push({
        id: operation.operationId ?? `${method}-${path}`.replace(/[^A-Za-z0-9]+/g, '-'),
        method: method.toUpperCase() as DocOperation['method'],
        path,
        tag: operation.tags?.[0] ?? 'Other',
        access: operation['x-access'] ?? (operation.security?.length ? 'user' : 'public'),
        operation,
      });
    }
  }
  return operations;
}

/** Operations grouped by tag, in the order the document declares its tags. */
export function groupByTag(document: OpenApiDocument, operations: DocOperation[]) {
  const order = document.tags?.map((tag) => tag.name) ?? [];
  const groups = new Map<string, DocOperation[]>();
  for (const name of order) groups.set(name, []);
  for (const operation of operations) {
    if (!groups.has(operation.tag)) groups.set(operation.tag, []);
    groups.get(operation.tag)!.push(operation);
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([name, items]) => ({
      name,
      description: document.tags?.find((tag) => tag.name === name)?.description,
      operations: items,
    }));
}

export function exampleOf(media: OpenApiMediaType | undefined): unknown {
  if (!media) return undefined;
  if (media.example !== undefined) return media.example;
  const first = media.examples ? Object.values(media.examples)[0] : undefined;
  if (first) return first.value;
  return media.schema?.example;
}

/** Environment variables the Quick Start environment defines for path ids. */
const PATH_VARIABLES: Record<string, string> = { products: 'productId', users: 'userId' };

/**
 * A ready-to-send tester request for an operation: `{{baseUrl}}` + path, path
 * ids from the environment, documented query parameters (optional ones
 * unticked), the example body, and `Bearer {{accessToken}}` when sign-in is needed.
 */
export function requestFromOperation(operation: DocOperation): LoadableRequest {
  const { operation: spec } = operation;
  const resource = operation.path.split('/')[1] ?? '';

  const path = operation.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const parameter = spec.parameters?.find((candidate) => candidate.in === 'path' && candidate.name === name);
    if (name === 'id' && PATH_VARIABLES[resource]) return `{{${PATH_VARIABLES[resource]}}}`;
    const example = parameter?.example ?? parameter?.schema?.example;
    return example !== undefined ? String(example) : `{{${name}}}`;
  });

  const queryParams = (spec.parameters ?? [])
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => {
      const example = parameter.example ?? parameter.schema?.example ?? parameter.schema?.default;
      return {
        key: parameter.name,
        value: example === undefined ? '' : String(example),
        enabled: Boolean(parameter.required) || (example !== undefined && parameter.name === 'limit'),
      };
    });

  const body = exampleOf(spec.requestBody?.content?.['application/json']);
  const needsToken = operation.access === 'user' || operation.access === 'admin';

  return {
    name: spec.summary ?? `${operation.method} ${operation.path}`,
    method: operation.method as HttpMethod,
    url: `{{baseUrl}}${path}`,
    queryParams,
    headers: body === undefined ? [] : [{ key: 'Content-Type', value: 'application/json', enabled: true }],
    bodyType: body === undefined ? 'NONE' : 'JSON',
    body: body === undefined ? '' : JSON.stringify(body, null, 2),
    auth: needsToken ? { type: 'BEARER', token: '{{accessToken}}' } : { type: 'NONE' },
  };
}
