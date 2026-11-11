import { prisma } from '../config/database.js';
import { toEnvironmentDto, type EnvironmentInput } from '../models/workspace.model.js';
import { AppError } from '../utils/app-error.js';

const withVariables = { variables: { orderBy: { key: 'asc' as const } } };

export async function listEnvironments(ownerId: number) {
  const rows = await prisma.environment.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'asc' },
    include: withVariables,
  });
  return rows.map(toEnvironmentDto);
}

async function findEnvironment(ownerId: number, id: string) {
  const row = await prisma.environment.findFirst({ where: { id, ownerId }, include: withVariables });
  if (!row) throw AppError.notFound('Environment');
  return row;
}

async function assertNameFree(ownerId: number, name: string, exceptId?: string) {
  const taken = await prisma.environment.findFirst({
    where: { ownerId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw AppError.conflict('You already have an environment with this name', { fields: ['name'] });
}

export async function getEnvironment(ownerId: number, id: string) {
  return toEnvironmentDto(await findEnvironment(ownerId, id));
}

/** The first environment a person creates becomes the active one. */
export async function createEnvironment(ownerId: number, input: EnvironmentInput) {
  await assertNameFree(ownerId, input.name);
  const isFirst = (await prisma.environment.count({ where: { ownerId } })) === 0;
  const row = await prisma.environment.create({
    data: { name: input.name, ownerId, isActive: isFirst, variables: { create: input.variables } },
    include: withVariables,
  });
  return toEnvironmentDto(row);
}

/** PUT replaces the name and the complete variable set atomically. */
export async function replaceEnvironment(ownerId: number, id: string, input: EnvironmentInput) {
  await findEnvironment(ownerId, id);
  await assertNameFree(ownerId, input.name, id);
  const row = await prisma.$transaction(async (tx) => {
    await tx.environmentVariable.deleteMany({ where: { environmentId: id } });
    return tx.environment.update({
      where: { id },
      data: { name: input.name, variables: { create: input.variables } },
      include: withVariables,
    });
  });
  return toEnvironmentDto(row);
}

export async function deleteEnvironment(ownerId: number, id: string) {
  await findEnvironment(ownerId, id);
  await prisma.environment.delete({ where: { id } });
  return { id, deleted: true };
}

export async function activateEnvironment(ownerId: number, id: string) {
  await findEnvironment(ownerId, id);
  const row = await prisma.$transaction(async (tx) => {
    await tx.environment.updateMany({ where: { ownerId }, data: { isActive: false } });
    return tx.environment.update({ where: { id }, data: { isActive: true }, include: withVariables });
  });
  return toEnvironmentDto(row);
}

export async function deactivateEnvironments(ownerId: number) {
  await prisma.environment.updateMany({ where: { ownerId }, data: { isActive: false } });
  return { active: null };
}
