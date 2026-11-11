import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/api-client';
import type { OpenApiDocument } from '@/types/openapi';
import { errorMessage, fieldErrorsFrom } from './form-errors';
import { safeNext } from './navigation';
import { listOperations, requestFromOperation } from './openapi';
import { bodyKind, fileExtension, findAccessToken, jsonError, prettyJson } from './response';

describe('form errors', () => {
  it('maps validation details onto field names', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      details: [
        { path: 'body.email', message: 'must be a valid email address' },
        { path: 'body.email', message: 'second message is ignored' },
        { path: 'query.limit', message: 'too big' },
      ],
    });
    expect(fieldErrorsFrom(error)).toEqual({ email: 'Must be a valid email address', limit: 'Too big' });
    expect(errorMessage(error)).toBe('Request validation failed: must be a valid email address');
  });

  it('maps conflicts and falls back for other errors', () => {
    expect(fieldErrorsFrom(new ApiError(409, 'CONFLICT', 'Taken', { details: { fields: ['email'] } }))).toEqual({
      email: 'This email is already in use',
    });
    expect(fieldErrorsFrom(new Error('x'))).toEqual({});
    expect(errorMessage('weird')).toBe('Something went wrong.');
  });
});

describe('safeNext', () => {
  it('only allows same-site paths', () => {
    expect(safeNext('/tester?x=1')).toBe('/tester?x=1');
    expect(safeNext('https://evil.example')).toBe('/dashboard');
    expect(safeNext('//evil.example')).toBe('/dashboard');
    expect(safeNext('/\\evil.example')).toBe('/dashboard');
    expect(safeNext(null)).toBe('/dashboard');
  });
});

describe('response helpers', () => {
  it('classifies bodies', () => {
    expect(bodyKind({ body: '{"a":1}', bodyEncoding: 'utf8', contentType: 'text/plain' })).toBe('json');
    expect(bodyKind({ body: '<p>', bodyEncoding: 'utf8', contentType: 'text/html' })).toBe('html');
    expect(bodyKind({ body: 'AAEC', bodyEncoding: 'base64', contentType: 'image/png' })).toBe('image');
    expect(bodyKind({ body: 'AAEC', bodyEncoding: 'base64', contentType: null })).toBe('binary');
    expect(bodyKind({ body: '', bodyEncoding: 'utf8', contentType: 'application/json' })).toBe('empty');
  });

  it('formats JSON and locates syntax errors', () => {
    expect(prettyJson('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(prettyJson('not json')).toBe('not json');
    expect(jsonError('{"a": 1}')).toBeNull();
    expect(jsonError('')).toBeNull();
    expect(jsonError('{\n  "a": 1,\n}')).toBeTruthy();
  });

  it('finds access tokens in common login response shapes', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
    expect(findAccessToken(JSON.stringify({ success: true, data: { accessToken: token } }))).toBe(token);
    expect(findAccessToken(JSON.stringify({ access_token: token }))).toBe(token);
    expect(findAccessToken(JSON.stringify({ token: 'short' }))).toBeNull();
    expect(findAccessToken('plain text')).toBeNull();
  });

  it('picks a download extension', () => {
    expect(fileExtension({ body: '{}', bodyEncoding: 'utf8', contentType: 'application/json' })).toBe('json');
    expect(fileExtension({ body: 'x', bodyEncoding: 'base64', contentType: 'image/svg+xml' })).toBe('svg');
  });
});

describe('OpenAPI to tester request', () => {
  const document: OpenApiDocument = {
    openapi: '3.1.0',
    info: { title: 'Aether', version: '1' },
    tags: [{ name: 'Products' }],
    paths: {
      '/products': {
        get: {
          operationId: 'listProducts',
          summary: 'List products',
          tags: ['Products'],
          'x-access': 'optional',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', example: 5 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
        },
      },
      '/products/{id}': {
        patch: {
          operationId: 'updateProduct',
          summary: 'Update a product',
          tags: ['Products'],
          'x-access': 'admin',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { content: { 'application/json': { example: { stock: 3 } } } },
        },
      },
    },
  };

  it('lists operations with their access level', () => {
    expect(listOperations(document).map((operation) => [operation.method, operation.path, operation.access])).toEqual([
      ['GET', '/products', 'optional'],
      ['PATCH', '/products/{id}', 'admin'],
    ]);
  });

  it('builds a ready-to-send request', () => {
    const [list, update] = listOperations(document);
    expect(requestFromOperation(list!)).toMatchObject({
      method: 'GET',
      url: '{{baseUrl}}/products',
      auth: { type: 'NONE' },
      bodyType: 'NONE',
      queryParams: [
        { key: 'limit', value: '5', enabled: true },
        { key: 'search', value: '', enabled: false },
      ],
    });
    expect(requestFromOperation(update!)).toMatchObject({
      method: 'PATCH',
      url: '{{baseUrl}}/products/{{productId}}',
      auth: { type: 'BEARER', token: '{{accessToken}}' },
      bodyType: 'JSON',
      body: '{\n  "stock": 3\n}',
    });
  });
});
