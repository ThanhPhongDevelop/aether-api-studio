import { z } from 'zod';
import { paginationFields, sortSchema } from '../utils/pagination.js';
import { httpUrlSchema } from './user.model.js';

const fields = {
  name: z.string('is required').trim().min(2, 'must be at least 2 characters').max(120),
  description: z.string().trim().max(2000).nullable(),
  price: z
    .number('must be a number')
    .positive('must be greater than 0')
    .max(1_000_000, 'must be at most 1,000,000')
    .multipleOf(0.01, 'can have at most 2 decimal places'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO currency code'),
  stock: z.number('must be a number').int('must be an integer').min(0).max(1_000_000),
  category: z.string('is required').trim().min(2, 'must be at least 2 characters').max(60),
  imageUrl: httpUrlSchema.nullable(),
  rating: z.number('must be a number').min(0).max(5),
  isActive: z.boolean('must be true or false'),
};

/** POST and PUT: full representation; optional fields fall back to defaults. */
export const productBody = z.object({
  name: fields.name,
  description: fields.description.default(null),
  price: fields.price,
  currency: fields.currency.default('USD'),
  stock: fields.stock.default(0),
  category: fields.category,
  imageUrl: fields.imageUrl.default(null),
  rating: fields.rating.default(0),
  isActive: fields.isActive.default(true),
});
export type ProductInput = z.infer<typeof productBody>;

/** PATCH: any subset of fields. */
export const updateProductBody = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export type ProductPatch = z.infer<typeof updateProductBody>;

export const productListQuery = z
  .object({
    ...paginationFields(),
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(60).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    inStock: z.stringbool().optional(),
    /** Inactive products are visible to admins only. */
    status: z.enum(['active', 'inactive', 'all']).default('active'),
    sort: sortSchema(['createdAt', 'name', 'price', 'rating', 'stock'], '-createdAt'),
  })
  .refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
    message: 'must be less than or equal to maxPrice',
    path: ['minPrice'],
  });
export type ProductListQuery = z.infer<typeof productListQuery>;
