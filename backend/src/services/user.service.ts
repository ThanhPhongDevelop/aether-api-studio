import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  toPublicUser,
  type AuthUser,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListQuery,
} from '../models/user.model.js';
import { AppError, ErrorCode } from '../utils/app-error.js';
import { pageMeta, toOrderBy, toSkipTake } from '../utils/pagination.js';
import { hashPassword } from '../utils/password.js';
import { notify } from './notification.service.js';
import { revokeAllForUser } from './token.service.js';
import { provisionStarterWorkspace } from './starter-workspace.js';

export async function listUsers(query: UserListQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.search ? { OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }] } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
  };
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: [toOrderBy(query.sort), { id: 'asc' }], ...toSkipTake(query) }),
  ]);
  return { items: users.map(toPublicUser), meta: pageMeta(total, query) };
}

async function findUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound('User');
  return user;
}

export async function getUser(id: number) {
  return toPublicUser(await findUser(id));
}

async function assertEmailAvailable(email: string, exceptId?: number) {
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (owner && owner.id !== exceptId) {
    throw AppError.conflict('An account with this email already exists', { fields: ['email'] });
  }
}

export async function createUser(input: CreateUserInput) {
  await assertEmailAvailable(input.email);
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        passwordHash,
        settings: { create: {} },
      },
    });
    await provisionStarterWorkspace(tx, created.id, created.email);
    return created;
  });
  await notify(user.id, {
    type: 'SUCCESS',
    title: 'Welcome to Aether API Studio',
    message: 'An administrator created this account for you.',
  });
  return toPublicUser(user);
}

/** At least one active admin must always remain, or nobody could manage the platform. */
async function assertAdminRemains(targetId: number) {
  const others = await prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: targetId } } });
  if (others === 0) {
    throw AppError.conflict('At least one active admin must remain', undefined, ErrorCode.LAST_ADMIN);
  }
}

export async function updateUser(id: number, input: UpdateUserInput, actor: AuthUser) {
  const isAdmin = actor.role === 'ADMIN';
  if (!isAdmin && (input.role !== undefined || input.isActive !== undefined)) {
    throw AppError.forbidden('Only admins can change roles or account status');
  }

  const existing = await findUser(id);
  if (input.email && input.email !== existing.email) await assertEmailAvailable(input.email, id);

  const losesAdmin =
    existing.role === 'ADMIN' &&
    existing.isActive &&
    ((input.role && input.role !== 'ADMIN') || input.isActive === false);
  if (losesAdmin) await assertAdminRemains(id);

  const { password, ...fields } = input;
  const user = await prisma.user.update({
    where: { id },
    data: { ...fields, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
  });

  // A new password or a deactivated account must not keep old sessions alive.
  if (password || input.isActive === false) await revokeAllForUser(id);
  return toPublicUser(user);
}

export async function deleteUser(id: number, actor: AuthUser) {
  if (id === actor.id) {
    throw AppError.conflict('You cannot delete your own account', undefined, ErrorCode.CANNOT_DELETE_SELF);
  }
  const existing = await findUser(id);
  if (existing.role === 'ADMIN' && existing.isActive) await assertAdminRemains(id);
  await prisma.user.delete({ where: { id } });
  return { id, deleted: true };
}
