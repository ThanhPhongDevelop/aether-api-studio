/**
 * OpenAPI 3.1 description of the Aether API, served at GET /api/docs and rendered
 * by the frontend's API Documentation page ("Try it" opens the request in the tester).
 */

type Access = 'public' | 'user' | 'admin' | 'optional';
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Parameter {
  name: string;
  in: 'path' | 'query';
  description: string;
  required?: boolean;
  type?: 'string' | 'integer' | 'number' | 'boolean';
  example?: unknown;
  enum?: string[];
}

interface Operation {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  access: Access;
  parameters?: Parameter[];
  body?: unknown;
  status?: number;
  errors?: number[];
}

const id = (what: string, example: unknown = 1): Parameter => ({
  name: 'id',
  in: 'path',
  required: true,
  type: typeof example === 'number' ? 'integer' : 'string',
  description: `${what} id`,
  example,
});
const page: Parameter[] = [
  { name: 'page', in: 'query', type: 'integer', description: 'Page number (1-based)', example: 1 },
  { name: 'limit', in: 'query', type: 'integer', description: 'Items per page (max 100)', example: 10 },
];

const sampleRequest = {
  name: 'List products',
  method: 'GET',
  url: '{{baseUrl}}/products',
  headers: [],
  queryParams: [{ key: 'limit', value: '5', enabled: true }],
  bodyType: 'NONE',
  body: null,
  auth: { type: 'NONE' },
  collectionId: null,
};

const OPERATIONS: Operation[] = [
  // System
  { method: 'get', path: '/', tag: 'System', summary: 'API index', access: 'public' },
  {
    method: 'get',
    path: '/health',
    tag: 'System',
    summary: 'Health check',
    description: 'Returns 200 when the database answers, 503 otherwise. Not rate limited.',
    access: 'public',
    errors: [503],
  },
  {
    method: 'get',
    path: '/status',
    tag: 'System',
    summary: 'Runtime, database and traffic statistics',
    access: 'public',
  },

  // Auth
  {
    method: 'post',
    path: '/auth/register',
    tag: 'Auth',
    summary: 'Create an account',
    description: 'Returns an access token and sets the httpOnly refresh-token cookie.',
    access: 'public',
    body: { name: 'New Tester', email: 'tester@example.com', password: 'Tester@123456' },
    status: 201,
    errors: [400, 409, 429],
  },
  {
    method: 'post',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Sign in',
    description: 'Five wrong passwords in a row lock the account for 15 minutes (429 ACCOUNT_LOCKED).',
    access: 'public',
    body: { email: 'demo@aether.dev', password: 'Demo@123456' },
    errors: [400, 401, 403, 429],
  },
  {
    method: 'post',
    path: '/auth/refresh',
    tag: 'Auth',
    summary: 'Rotate the refresh token',
    description: 'Uses the refresh-token cookie; reusing an old token revokes the whole session chain.',
    access: 'public',
    errors: [401],
  },
  { method: 'post', path: '/auth/logout', tag: 'Auth', summary: 'Sign out this session', access: 'public' },
  {
    method: 'post',
    path: '/auth/logout-all',
    tag: 'Auth',
    summary: 'Sign out every session',
    access: 'user',
    errors: [401],
  },
  { method: 'get', path: '/auth/profile', tag: 'Auth', summary: 'Current user', access: 'user', errors: [401] },
  {
    method: 'patch',
    path: '/auth/profile',
    tag: 'Auth',
    summary: 'Update your profile',
    access: 'user',
    body: { name: 'Demo User', bio: 'Testing APIs in 3D.' },
    errors: [400, 401],
  },
  {
    method: 'post',
    path: '/auth/change-password',
    tag: 'Auth',
    summary: 'Change your password',
    description: 'Signs out every other session.',
    access: 'user',
    body: { currentPassword: 'Demo@123456', newPassword: 'Demo@654321' },
    errors: [400, 401],
  },

  // Users
  {
    method: 'get',
    path: '/users',
    tag: 'Users',
    summary: 'List users',
    access: 'admin',
    parameters: [
      ...page,
      { name: 'search', in: 'query', description: 'Matches name or email', example: 'nguyen' },
      { name: 'role', in: 'query', description: 'Filter by role', enum: ['USER', 'ADMIN'] },
      { name: 'isActive', in: 'query', type: 'boolean', description: 'Filter by status' },
      { name: 'sort', in: 'query', description: 'Field, prefix with - for descending', example: '-createdAt' },
    ],
    errors: [401, 403],
  },
  {
    method: 'post',
    path: '/users',
    tag: 'Users',
    summary: 'Create a user',
    access: 'admin',
    body: { name: 'Hà Minh Anh', email: 'anh.ha@example.com', password: 'Member@123456', role: 'USER' },
    status: 201,
    errors: [400, 401, 403, 409],
  },
  {
    method: 'get',
    path: '/users/{id}',
    tag: 'Users',
    summary: 'Get a user',
    description: 'Admins can read anyone; users only themselves.',
    access: 'user',
    parameters: [id('User', 2)],
    errors: [401, 403, 404],
  },
  {
    method: 'put',
    path: '/users/{id}',
    tag: 'Users',
    summary: 'Replace a user',
    access: 'user',
    parameters: [id('User', 2)],
    body: { name: 'Demo User', email: 'demo@aether.dev', bio: null, avatarUrl: null },
    errors: [400, 401, 403, 404, 409],
  },
  {
    method: 'patch',
    path: '/users/{id}',
    tag: 'Users',
    summary: 'Update a user',
    description: 'Only admins may change role or isActive. The last active admin cannot be demoted.',
    access: 'user',
    parameters: [id('User', 2)],
    body: { bio: 'Updated from the API tester' },
    errors: [400, 401, 403, 404, 409],
  },
  {
    method: 'delete',
    path: '/users/{id}',
    tag: 'Users',
    summary: 'Delete a user',
    access: 'admin',
    parameters: [id('User', 6)],
    errors: [401, 403, 404, 409],
  },

  // Products
  {
    method: 'get',
    path: '/products',
    tag: 'Products',
    summary: 'List products',
    access: 'optional',
    parameters: [
      ...page,
      { name: 'search', in: 'query', description: 'Matches name or description', example: 'wireless' },
      { name: 'category', in: 'query', description: 'Exact category', example: 'Audio' },
      { name: 'minPrice', in: 'query', type: 'number', description: 'Minimum price' },
      { name: 'maxPrice', in: 'query', type: 'number', description: 'Maximum price' },
      { name: 'inStock', in: 'query', type: 'boolean', description: 'Only products with stock' },
      {
        name: 'status',
        in: 'query',
        description: 'Admins only: include inactive products',
        enum: ['active', 'inactive', 'all'],
      },
      {
        name: 'sort',
        in: 'query',
        description: 'name, price, rating, stock or createdAt; prefix - for descending',
        example: '-price',
      },
    ],
    errors: [400],
  },
  {
    method: 'get',
    path: '/products/categories',
    tag: 'Products',
    summary: 'Categories with product counts',
    access: 'public',
  },
  {
    method: 'get',
    path: '/products/{id}',
    tag: 'Products',
    summary: 'Get a product',
    access: 'optional',
    parameters: [id('Product')],
    errors: [404],
  },
  {
    method: 'post',
    path: '/products',
    tag: 'Products',
    summary: 'Create a product',
    access: 'admin',
    body: {
      name: 'Helix Mechanical Numpad',
      description: 'Compact hot-swap numpad.',
      price: 49.5,
      stock: 30,
      category: 'Accessories',
    },
    status: 201,
    errors: [400, 401, 403],
  },
  {
    method: 'put',
    path: '/products/{id}',
    tag: 'Products',
    summary: 'Replace a product',
    access: 'admin',
    parameters: [id('Product')],
    body: { name: 'Quantum Mechanical Keyboard', price: 139.99, stock: 40, category: 'Accessories' },
    errors: [400, 401, 403, 404],
  },
  {
    method: 'patch',
    path: '/products/{id}',
    tag: 'Products',
    summary: 'Update a product',
    access: 'admin',
    parameters: [id('Product')],
    body: { stock: 99 },
    errors: [400, 401, 403, 404],
  },
  {
    method: 'delete',
    path: '/products/{id}',
    tag: 'Products',
    summary: 'Delete a product',
    access: 'admin',
    parameters: [id('Product', 12)],
    errors: [401, 403, 404],
  },

  // Account
  { method: 'get', path: '/settings', tag: 'Account', summary: 'Your settings', access: 'user', errors: [401] },
  {
    method: 'patch',
    path: '/settings',
    tag: 'Account',
    summary: 'Update settings',
    access: 'user',
    body: { theme: 'DARK', requestTimeoutMs: 15000 },
    errors: [400, 401],
  },
  {
    method: 'get',
    path: '/notifications',
    tag: 'Account',
    summary: 'Your notifications',
    access: 'user',
    parameters: [...page, { name: 'unread', in: 'query', type: 'boolean', description: 'Only unread' }],
    errors: [401],
  },
  {
    method: 'get',
    path: '/notifications/unread-count',
    tag: 'Account',
    summary: 'Unread notification count',
    access: 'user',
    errors: [401],
  },
  {
    method: 'post',
    path: '/notifications/read-all',
    tag: 'Account',
    summary: 'Mark all as read',
    access: 'user',
    errors: [401],
  },
  {
    method: 'patch',
    path: '/notifications/{id}/read',
    tag: 'Account',
    summary: 'Mark one as read',
    access: 'user',
    parameters: [id('Notification', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'delete',
    path: '/notifications/{id}',
    tag: 'Account',
    summary: 'Delete a notification',
    access: 'user',
    parameters: [id('Notification', 'cm…')],
    errors: [401, 404],
  },

  // Workspace
  {
    method: 'get',
    path: '/collections',
    tag: 'Workspace',
    summary: 'Collections with their saved requests',
    access: 'user',
    errors: [401],
  },
  {
    method: 'post',
    path: '/collections',
    tag: 'Workspace',
    summary: 'Create a collection',
    access: 'user',
    body: { name: 'Payments API', description: 'Checkout flow' },
    status: 201,
    errors: [400, 401, 409],
  },
  {
    method: 'get',
    path: '/collections/{id}',
    tag: 'Workspace',
    summary: 'Get a collection',
    access: 'user',
    parameters: [id('Collection', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'patch',
    path: '/collections/{id}',
    tag: 'Workspace',
    summary: 'Rename a collection',
    access: 'user',
    parameters: [id('Collection', 'cm…')],
    body: { name: 'Payments API v2' },
    errors: [400, 401, 404, 409],
  },
  {
    method: 'delete',
    path: '/collections/{id}',
    tag: 'Workspace',
    summary: 'Delete a collection and its requests',
    access: 'user',
    parameters: [id('Collection', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'get',
    path: '/saved-requests',
    tag: 'Workspace',
    summary: 'Saved requests',
    access: 'user',
    parameters: [{ name: 'collectionId', in: 'query', description: 'Only this collection' }],
    errors: [401],
  },
  {
    method: 'post',
    path: '/saved-requests',
    tag: 'Workspace',
    summary: 'Save a request',
    access: 'user',
    body: sampleRequest,
    status: 201,
    errors: [400, 401],
  },
  {
    method: 'get',
    path: '/saved-requests/{id}',
    tag: 'Workspace',
    summary: 'Get a saved request',
    access: 'user',
    parameters: [id('Saved request', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'put',
    path: '/saved-requests/{id}',
    tag: 'Workspace',
    summary: 'Update a saved request',
    access: 'user',
    parameters: [id('Saved request', 'cm…')],
    body: sampleRequest,
    errors: [400, 401, 404],
  },
  {
    method: 'delete',
    path: '/saved-requests/{id}',
    tag: 'Workspace',
    summary: 'Delete a saved request',
    access: 'user',
    parameters: [id('Saved request', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'get',
    path: '/history',
    tag: 'Workspace',
    summary: 'Request history',
    access: 'user',
    parameters: [
      ...page,
      { name: 'search', in: 'query', description: 'Matches the URL' },
      { name: 'method', in: 'query', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { name: 'status', in: 'query', description: 'Outcome', enum: ['success', 'error', '2xx', '3xx', '4xx', '5xx'] },
    ],
    errors: [401],
  },
  { method: 'delete', path: '/history', tag: 'Workspace', summary: 'Clear history', access: 'user', errors: [401] },
  {
    method: 'get',
    path: '/history/{id}',
    tag: 'Workspace',
    summary: 'History entry with full request and response',
    access: 'user',
    parameters: [id('History entry', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'delete',
    path: '/history/{id}',
    tag: 'Workspace',
    summary: 'Delete a history entry',
    access: 'user',
    parameters: [id('History entry', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'get',
    path: '/environments',
    tag: 'Workspace',
    summary: 'Environments and variables',
    access: 'user',
    errors: [401],
  },
  {
    method: 'post',
    path: '/environments',
    tag: 'Workspace',
    summary: 'Create an environment',
    access: 'user',
    body: {
      name: 'Staging',
      variables: [{ key: 'baseUrl', value: 'https://staging.example.com/api', isSecret: false, enabled: true }],
    },
    status: 201,
    errors: [400, 401, 409],
  },
  {
    method: 'post',
    path: '/environments/deactivate',
    tag: 'Workspace',
    summary: 'Use no environment',
    access: 'user',
    errors: [401],
  },
  {
    method: 'put',
    path: '/environments/{id}',
    tag: 'Workspace',
    summary: 'Replace an environment and its variables',
    access: 'user',
    parameters: [id('Environment', 'cm…')],
    body: { name: 'Local', variables: [{ key: 'baseUrl', value: 'http://localhost:4000/api' }] },
    errors: [400, 401, 404, 409],
  },
  {
    method: 'delete',
    path: '/environments/{id}',
    tag: 'Workspace',
    summary: 'Delete an environment',
    access: 'user',
    parameters: [id('Environment', 'cm…')],
    errors: [401, 404],
  },
  {
    method: 'post',
    path: '/environments/{id}/activate',
    tag: 'Workspace',
    summary: 'Make an environment active',
    access: 'user',
    parameters: [id('Environment', 'cm…')],
    errors: [401, 404],
  },

  // Tester
  {
    method: 'post',
    path: '/requests/execute',
    tag: 'Tester',
    summary: 'Send a request from the server',
    description:
      'Executes a real HTTP request, measures it and stores it in your history. Private network targets are blocked in production (400 TARGET_NOT_ALLOWED).',
    access: 'user',
    body: {
      method: 'GET',
      url: 'http://localhost:4000/api/products',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      queryParams: [{ key: 'limit', value: '3', enabled: true }],
      bodyType: 'NONE',
      body: null,
      auth: { type: 'NONE' },
    },
    errors: [400, 401, 429],
  },
  {
    method: 'get',
    path: '/dashboard/stats',
    tag: 'Tester',
    summary: 'Usage statistics',
    access: 'user',
    parameters: [
      {
        name: 'scope',
        in: 'query',
        description: '"me" = your tester requests, "server" = all API traffic (admin)',
        enum: ['me', 'server'],
      },
      { name: 'range', in: 'query', description: 'Time window', enum: ['24h', '7d', '30d'] },
      {
        name: 'tzOffset',
        in: 'query',
        type: 'integer',
        description: 'Minutes east of UTC for local buckets',
        example: 420,
      },
    ],
    errors: [401, 403],
  },
  { method: 'get', path: '/docs', tag: 'System', summary: 'This OpenAPI document', access: 'public' },
];

const ERROR_TEXT: Record<number, string> = {
  400: 'Validation failed or bad request',
  401: 'Missing, invalid or expired token',
  403: 'Not allowed for your role',
  404: 'Not found',
  409: 'Conflict with existing data',
  429: 'Rate limited or account locked',
  503: 'Dependency unavailable',
};

export function buildOpenApiDocument(version: string) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const operation of OPERATIONS) {
    const status = String(operation.status ?? 200);
    const responses: Record<string, unknown> = {
      [status]: {
        description: status === '201' ? 'Created' : 'Success',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
      },
    };
    for (const code of operation.errors ?? []) {
      responses[String(code)] = {
        description: ERROR_TEXT[code] ?? 'Error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      };
    }

    paths[operation.path] ??= {};
    paths[operation.path]![operation.method] = {
      tags: [operation.tag],
      summary: operation.summary,
      ...(operation.description ? { description: operation.description } : {}),
      'x-access': operation.access,
      security: operation.access === 'user' || operation.access === 'admin' ? [{ bearerAuth: [] }] : [],
      parameters: (operation.parameters ?? []).map((parameter) => ({
        name: parameter.name,
        in: parameter.in,
        required: parameter.required ?? parameter.in === 'path',
        description: parameter.description,
        schema: { type: parameter.type ?? 'string', ...(parameter.enum ? { enum: parameter.enum } : {}) },
        ...(parameter.example === undefined ? {} : { example: parameter.example }),
      })),
      ...(operation.body === undefined
        ? {}
        : { requestBody: { required: true, content: { 'application/json': { example: operation.body } } } }),
      responses,
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Aether API',
      version,
      description:
        'REST API behind Aether API Studio. Every response uses the envelope { success, data, meta } or { success: false, error: { code, message, details, requestId } }.',
    },
    servers: [{ url: '/api' }],
    tags: [
      { name: 'System', description: 'Health, status and this document' },
      { name: 'Auth', description: 'Sign-up, sign-in, sessions and profile' },
      { name: 'Users', description: 'User management' },
      { name: 'Products', description: 'Product catalogue (demo resource)' },
      { name: 'Account', description: 'Settings and notifications' },
      { name: 'Workspace', description: 'Collections, saved requests, history and environments' },
      { name: 'Tester', description: 'Request execution and usage statistics' },
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Success: {
          type: 'object',
          required: ['success', 'data'],
          properties: { success: { const: true }, data: {}, meta: { type: 'object' } },
        },
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { const: false },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string' },
                details: {},
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    paths,
  };
}
