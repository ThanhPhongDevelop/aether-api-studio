import type { Product, ProductCategory, PublicUser, Role } from '@/types/models';
import { api, withQuery } from './api-client';

// ─── Products ─────────────────────────────────────────────────────────────────

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  status?: 'active' | 'inactive' | 'all';
  sort?: string;
}

export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number;
  category: string;
  imageUrl: string | null;
  rating: number;
  isActive: boolean;
}

export const productService = {
  list: (query: ProductQuery, signal?: AbortSignal) =>
    api.list<Product>(withQuery('/products', { ...query }), { signal }),
  categories: (signal?: AbortSignal) => api.get<ProductCategory[]>('/products/categories', { signal }),
  get: (id: number) => api.get<Product>(`/products/${id}`),
  create: (input: ProductInput) => api.post<Product>('/products', input),
  update: (id: number, input: Partial<ProductInput>) => api.patch<Product>(`/products/${id}`, input),
  remove: (id: number) => api.delete<{ id: number; deleted: boolean }>(`/products/${id}`),
};

// ─── Users (admin) ────────────────────────────────────────────────────────────

export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  sort?: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  bio?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
  bio?: string | null;
  avatarUrl?: string | null;
}

export const userService = {
  list: (query: UserQuery, signal?: AbortSignal) => api.list<PublicUser>(withQuery('/users', { ...query }), { signal }),
  get: (id: number) => api.get<PublicUser>(`/users/${id}`),
  create: (input: CreateUserInput) => api.post<PublicUser>('/users', input),
  update: (id: number, input: UpdateUserInput) => api.patch<PublicUser>(`/users/${id}`, input),
  remove: (id: number) => api.delete<{ id: number; deleted: boolean }>(`/users/${id}`),
};
