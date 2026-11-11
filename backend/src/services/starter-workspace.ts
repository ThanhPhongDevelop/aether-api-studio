/**
 * The starter workspace every account gets: the "Quick Start" collection with a
 * ready-to-run request for each endpoint, and an active "Local" environment.
 * Used by the database seed and by registration.
 */
import { env } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';

// Type aliases (not interfaces) so they are assignable to Prisma's JSON input type.
export type KeyValue = {
  key: string;
  value: string;
  enabled: boolean;
};

export type StarterRequest = {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: KeyValue[];
  queryParams: KeyValue[];
  bodyType: 'NONE' | 'JSON' | 'RAW';
  body: string | null;
  authType: 'NONE' | 'BEARER' | 'BASIC';
  auth: { token: string } | null;
};

const jsonHeaders: KeyValue[] = [{ key: 'Content-Type', value: 'application/json', enabled: true }];
const bearer = { authType: 'BEARER' as const, auth: { token: '{{accessToken}}' } };
const json = (value: unknown) => JSON.stringify(value, null, 2);

function request(
  partial: Partial<StarterRequest> & Pick<StarterRequest, 'name' | 'description' | 'method' | 'url'>,
): StarterRequest {
  return { headers: [], queryParams: [], bodyType: 'NONE', body: null, authType: 'NONE', auth: null, ...partial };
}

export const QUICK_START_COLLECTION = {
  name: 'Quick Start',
  description: 'Ready-to-run requests for every endpoint of the Aether API. Uses the {{baseUrl}} environment variable.',
};

/** Variables of the default "Local" environment ({{name}} placeholders above). */
export function localEnvironmentVariables(baseUrl: string) {
  return [
    { key: 'baseUrl', value: baseUrl, isSecret: false },
    { key: 'accessToken', value: '', isSecret: true },
    { key: 'productId', value: '1', isSecret: false },
    { key: 'userId', value: '2', isSecret: false },
  ];
}

/** The Quick Start requests; `login` fills the body of the "Login" request. */
export function quickStartRequests(login: { label: string; email: string; password: string }): StarterRequest[] {
  return [
    request({
      name: 'Health check',
      description: 'Liveness probe with a database round-trip.',
      method: 'GET',
      url: '{{baseUrl}}/health',
    }),
    request({
      name: 'System status',
      description: 'Runtime, database and traffic statistics.',
      method: 'GET',
      url: '{{baseUrl}}/status',
    }),
    request({
      name: 'Register',
      description: 'Create a new account (password: 8+ chars with upper, lower, number and symbol).',
      method: 'POST',
      url: '{{baseUrl}}/auth/register',
      headers: jsonHeaders,
      bodyType: 'JSON',
      body: json({ name: 'New Tester', email: 'tester@example.com', password: 'Tester@123456' }),
    }),
    request({
      name: `Login (${login.label})`,
      description: 'Returns an access token — use "Save token" in the response to store it as {{accessToken}}.',
      method: 'POST',
      url: '{{baseUrl}}/auth/login',
      headers: jsonHeaders,
      bodyType: 'JSON',
      body: json({ email: login.email, password: login.password }),
    }),
    request({
      name: 'My profile',
      description: 'Current user resolved from the bearer token.',
      method: 'GET',
      url: '{{baseUrl}}/auth/profile',
      ...bearer,
    }),
    request({
      name: 'List products',
      description: 'Paginated list with search, category filter and sorting.',
      method: 'GET',
      url: '{{baseUrl}}/products',
      queryParams: [
        { key: 'page', value: '1', enabled: true },
        { key: 'limit', value: '10', enabled: true },
        { key: 'search', value: 'wireless', enabled: false },
        { key: 'category', value: 'Audio', enabled: false },
        { key: 'sort', value: '-price', enabled: false },
      ],
    }),
    request({
      name: 'Get product',
      description: 'Single product by id.',
      method: 'GET',
      url: '{{baseUrl}}/products/{{productId}}',
    }),
    request({
      name: 'Create product (admin)',
      description: 'Requires an ADMIN access token.',
      method: 'POST',
      url: '{{baseUrl}}/products',
      headers: jsonHeaders,
      bodyType: 'JSON',
      body: json({
        name: 'Helix Mechanical Numpad',
        description: 'Compact hot-swap numpad.',
        price: 49.5,
        stock: 30,
        category: 'Accessories',
      }),
      ...bearer,
    }),
    request({
      name: 'Replace product (admin)',
      description: 'Full update with PUT.',
      method: 'PUT',
      url: '{{baseUrl}}/products/{{productId}}',
      headers: jsonHeaders,
      bodyType: 'JSON',
      body: json({
        name: 'Quantum Mechanical Keyboard',
        description: 'Hot-swappable 75% keyboard.',
        price: 139.99,
        stock: 40,
        category: 'Accessories',
      }),
      ...bearer,
    }),
    request({
      name: 'Update stock (admin)',
      description: 'Partial update with PATCH.',
      method: 'PATCH',
      url: '{{baseUrl}}/products/{{productId}}',
      headers: jsonHeaders,
      bodyType: 'JSON',
      body: json({ stock: 99 }),
      ...bearer,
    }),
    request({
      name: 'Delete product (admin)',
      description: 'Permanently removes a product.',
      method: 'DELETE',
      url: '{{baseUrl}}/products/12',
      ...bearer,
    }),
    request({
      name: 'List users (admin)',
      description: 'Paginated user list.',
      method: 'GET',
      url: '{{baseUrl}}/users',
      ...bearer,
    }),
    request({
      name: 'Get user',
      description: 'Single user by id.',
      method: 'GET',
      url: '{{baseUrl}}/users/{{userId}}',
      ...bearer,
    }),
  ];
}

/** Where new accounts' requests should point by default. */
export const starterBaseUrl = () => env.PUBLIC_API_URL?.replace(/\/+$/, '') ?? `http://localhost:${env.PORT}/api`;

/**
 * Create the Quick Start collection and the active "Local" environment for a new
 * account. The Login request is pre-filled with the account's email only — a
 * password is never written into a saved request.
 */
export async function provisionStarterWorkspace(db: Prisma.TransactionClient, ownerId: number, email: string) {
  const collection = await db.collection.create({ data: { ...QUICK_START_COLLECTION, ownerId } });
  await db.savedRequest.createMany({
    data: quickStartRequests({ label: 'your account', email, password: '' }).map((item, index) => ({
      ...item,
      auth: item.auth ?? undefined,
      sortOrder: index,
      ownerId,
      collectionId: collection.id,
    })),
  });
  await db.environment.create({
    data: {
      name: 'Local',
      ownerId,
      isActive: true,
      variables: { create: localEnvironmentVariables(starterBaseUrl()) },
    },
  });
}
