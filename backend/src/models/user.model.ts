import { z } from 'zod';
import type { User } from '../generated/prisma/client.js';
import { paginationFields, sortSchema } from '../utils/pagination.js';

export const ROLES = ['USER', 'ADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

/** 8–72 characters (bcrypt limit) with lower, upper, digit and symbol. */
export const passwordSchema = z
  .string('is required')
  .min(8, 'must be at least 8 characters')
  .max(72, 'must be at most 72 characters')
  .regex(/[a-z]/, 'must contain a lowercase letter')
  .regex(/[A-Z]/, 'must contain an uppercase letter')
  .regex(/\d/, 'must contain a number')
  .regex(/[^A-Za-z0-9]/, 'must contain a symbol');

export const emailSchema = z
  .string('is required')
  .trim()
  .toLowerCase()
  .max(254, 'must be at most 254 characters')
  .pipe(z.email('must be a valid email address'));

export const nameSchema = z.string('is required').trim().min(2, 'must be at least 2 characters').max(80);
export const bioSchema = z.string().trim().max(500, 'must be at most 500 characters').nullable();
export const httpUrlSchema = z
  .url('must be a valid URL')
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), 'must start with http:// or https://');

export const userListQuery = z.object({
  ...paginationFields(),
  search: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.stringbool().optional(),
  sort: sortSchema(['createdAt', 'name', 'email', 'lastLoginAt'], '-createdAt'),
});
export type UserListQuery = z.infer<typeof userListQuery>;

export const createUserBody = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES).default('USER'),
  isActive: z.boolean().default(true),
  bio: bioSchema.optional(),
  avatarUrl: httpUrlSchema.nullable().optional(),
});
export type CreateUserInput = z.infer<typeof createUserBody>;

/** PUT: name and email are required; omitted optional fields are cleared. */
export const replaceUserBody = z.object({
  name: nameSchema,
  email: emailSchema,
  bio: bioSchema.default(null),
  avatarUrl: httpUrlSchema.nullable().default(null),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

/** PATCH: any subset of fields. */
export const updateUserBody = z
  .object({
    name: nameSchema,
    email: emailSchema,
    bio: bioSchema,
    avatarUrl: httpUrlSchema.nullable(),
    role: z.enum(ROLES),
    isActive: z.boolean(),
    password: passwordSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export type UpdateUserInput = z.infer<typeof updateUserBody>;

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: RoleName;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Strip secrets (password hash, lockout counters) before anything leaves the API. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** The authenticated principal attached to `req.user`. */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: RoleName;
}
