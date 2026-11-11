import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/database.js';

let sequence = 0;

/** Remove every row so a test file starts from a known, empty state. */
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.apiLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.environmentVariable.deleteMany(),
    prisma.environment.deleteMany(),
    prisma.requestHistory.deleteMany(),
    prisma.savedRequest.deleteMany(),
    prisma.collection.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.product.deleteMany(),
    prisma.userSettings.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createUser(overrides: { email?: string; role?: 'USER' | 'ADMIN'; password?: string } = {}) {
  sequence += 1;
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${sequence}@test.dev`,
      name: `Test User ${sequence}`,
      role: overrides.role ?? 'USER',
      passwordHash: await bcrypt.hash(overrides.password ?? 'Test@123456', 4),
      settings: { create: {} },
    },
  });
}

export async function createProduct(overrides: { name?: string; price?: number; createdById?: number } = {}) {
  sequence += 1;
  const name = overrides.name ?? `Test Product ${sequence}`;
  return prisma.product.create({
    data: {
      name,
      slug: `test-product-${sequence}`,
      price: overrides.price ?? 10,
      category: 'Testing',
      createdById: overrides.createdById ?? null,
    },
  });
}
