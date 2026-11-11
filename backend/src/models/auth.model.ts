import { z } from 'zod';
import { bioSchema, emailSchema, httpUrlSchema, nameSchema, passwordSchema, type PublicUser } from './user.model.js';

export const registerBody = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.string('is required').trim().toLowerCase().min(1, 'is required').max(254),
  password: z.string('is required').min(1, 'is required').max(200),
});
export type LoginInput = z.infer<typeof loginBody>;

export const updateProfileBody = z
  .object({ name: nameSchema, bio: bioSchema, avatarUrl: httpUrlSchema.nullable() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export type UpdateProfileInput = z.infer<typeof updateProfileBody>;

export const changePasswordBody = z
  .object({
    currentPassword: z.string('is required').min(1, 'is required').max(200),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'must be different from the current password',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordBody>;

export interface SessionPayload {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

/** Request metadata stored with each refresh token (shown as "active sessions"). */
export interface ClientInfo {
  userAgent: string | null;
  ipAddress: string | null;
}
