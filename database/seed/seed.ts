/**
 * Demo data seed — run with `npm run db:seed` (or automatically by `npm run setup`).
 *
 * Idempotent: users are matched by email, products by slug, collections and
 * environments by (owner, name). Re-running restores demo accounts and the
 * Quick Start collection without touching other data you created.
 */
import bcrypt from 'bcryptjs';
import { createPrismaClient } from '../../backend/src/config/database.js';
import { env } from '../../backend/src/config/env.js';
import { slugify } from '../../backend/src/utils/format.js';
import { seedProducts } from './data/products.js';
import {
  localEnvironmentVariables,
  QUICK_START_COLLECTION,
  quickStartRequests,
  starterBaseUrl,
} from '../../backend/src/services/starter-workspace.js';
import { DEMO_ACCOUNTS, seedUsers } from './data/users.js';

const prisma = createPrismaClient();

async function seedAccounts() {
  const hashes = new Map<string, Promise<string>>();
  const hash = (password: string) => {
    if (!hashes.has(password)) hashes.set(password, bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS));
    return hashes.get(password)!;
  };

  const users = [];
  for (const user of seedUsers) {
    const data = {
      name: user.name,
      role: user.role,
      bio: user.bio,
      isActive: user.isActive ?? true,
      passwordHash: await hash(user.password),
    };
    users.push(
      await prisma.user.upsert({
        where: { email: user.email },
        create: { email: user.email, ...data, settings: { create: {} } },
        update: { ...data, settings: { upsert: { create: {}, update: {} } } },
      }),
    );
  }
  return users;
}

async function seedCatalog(adminId: number) {
  for (const product of seedProducts) {
    const data = { ...product, isActive: product.isActive ?? true };
    await prisma.product.upsert({
      where: { slug: slugify(product.name) },
      create: { ...data, slug: slugify(product.name), createdById: adminId },
      update: data,
    });
  }
}

async function seedWorkspace(ownerId: number) {
  await prisma.$transaction(async (tx) => {
    const collection = await tx.collection.upsert({
      where: { ownerId_name: { ownerId, name: QUICK_START_COLLECTION.name } },
      create: { ...QUICK_START_COLLECTION, ownerId },
      update: { description: QUICK_START_COLLECTION.description },
    });

    await tx.savedRequest.deleteMany({ where: { collectionId: collection.id } });
    await tx.savedRequest.createMany({
      data: quickStartRequests({ label: 'demo user', ...DEMO_ACCOUNTS.demo }).map((item, index) => ({
        ...item,
        auth: item.auth ?? undefined,
        sortOrder: index,
        ownerId,
        collectionId: collection.id,
      })),
    });

    const environment = await tx.environment.upsert({
      where: { ownerId_name: { ownerId, name: 'Local' } },
      create: { name: 'Local', ownerId, isActive: true },
      update: { isActive: true },
    });

    for (const variable of localEnvironmentVariables(starterBaseUrl())) {
      await tx.environmentVariable.upsert({
        where: { environmentId_key: { environmentId: environment.id, key: variable.key } },
        create: { ...variable, environmentId: environment.id },
        update: { value: variable.value, isSecret: variable.isSecret },
      });
    }
  });
}

async function seedNotifications(userIds: number[]) {
  for (const userId of userIds) {
    const existing = await prisma.notification.count({ where: { userId } });
    if (existing > 0) continue;
    await prisma.notification.create({
      data: {
        userId,
        type: 'SUCCESS',
        title: 'Welcome to Aether API Studio',
        message: 'Your workspace is ready. Open the Quick Start collection to send your first request.',
      },
    });
  }
}

async function main() {
  const started = performance.now();
  console.log('🌱 Seeding database…');

  const users = await seedAccounts();
  const admin = users.find((user) => user.email === DEMO_ACCOUNTS.admin.email)!;
  const demo = users.find((user) => user.email === DEMO_ACCOUNTS.demo.email)!;

  await seedCatalog(admin.id);
  await seedWorkspace(admin.id);
  await seedWorkspace(demo.id);
  await seedNotifications(users.map((user) => user.id));

  const [userCount, productCount, requestCount] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.savedRequest.count(),
  ]);

  console.log(`✅ Done in ${Math.round(performance.now() - started)} ms`);
  console.table({ users: userCount, products: productCount, savedRequests: requestCount });
  console.log(`   Admin login: ${DEMO_ACCOUNTS.admin.email} / ${DEMO_ACCOUNTS.admin.password}`);
  console.log(`   Demo login:  ${DEMO_ACCOUNTS.demo.email} / ${DEMO_ACCOUNTS.demo.password}`);
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
