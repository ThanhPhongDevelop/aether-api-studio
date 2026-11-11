import { z } from 'zod';

export interface PageParams {
  page: number;
  limit: number;
}

export interface PageMeta extends PageParams {
  total: number;
  totalPages: number;
}

/** Spread into a query schema: `z.object({ ...paginationFields(), search: … })`. */
export const paginationFields = (defaultLimit = 10) => ({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(defaultLimit),
});

export const toSkipTake = ({ page, limit }: PageParams) => ({ skip: (page - 1) * limit, take: limit });

export const pageMeta = (total: number, { page, limit }: PageParams): PageMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Allowed `sort` values: each field ascending or, prefixed with "-", descending. */
export function sortSchema<const T extends string>(fields: readonly T[], fallback: `-${T}` | T) {
  const values = fields.flatMap((field) => [field, `-${field}`]) as [string, ...string[]];
  return z.enum(values).default(fallback);
}

/** "-price" → `{ price: 'desc' }`. */
export function toOrderBy(sort: string): Record<string, 'asc' | 'desc'> {
  return sort.startsWith('-') ? { [sort.slice(1)]: 'desc' } : { [sort]: 'asc' };
}

export const intIdParams = z.object({
  id: z.coerce.number('must be a number').int().positive('must be a positive integer'),
});
export const stringIdParams = z.object({ id: z.string().trim().min(1).max(64) });
