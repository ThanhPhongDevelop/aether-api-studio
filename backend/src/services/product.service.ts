import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ProductInput, ProductListQuery, ProductPatch } from '../models/product.model.js';
import { AppError } from '../utils/app-error.js';
import { slugify } from '../utils/format.js';
import { pageMeta, toOrderBy, toSkipTake } from '../utils/pagination.js';

const withCreator = { createdBy: { select: { id: true, name: true } } } satisfies Prisma.ProductInclude;

export async function listProducts(query: ProductListQuery, { canSeeInactive }: { canSeeInactive: boolean }) {
  const status = canSeeInactive ? query.status : 'active';
  const where: Prisma.ProductWhereInput = {
    ...(status === 'all' ? {} : { isActive: status === 'active' }),
    ...(query.search
      ? { OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }] }
      : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          price: {
            ...(query.minPrice === undefined ? {} : { gte: query.minPrice }),
            ...(query.maxPrice === undefined ? {} : { lte: query.maxPrice }),
          },
        }
      : {}),
    ...(query.inStock === undefined ? {} : query.inStock ? { stock: { gt: 0 } } : { stock: 0 }),
  };

  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: withCreator,
      orderBy: [toOrderBy(query.sort), { id: 'asc' }],
      ...toSkipTake(query),
    }),
  ]);
  return { items, meta: pageMeta(total, query) };
}

export async function listCategories() {
  const rows = await prisma.product.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: { _all: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((row) => ({ name: row.category, count: row._count._all }));
}

export async function getProduct(id: number, { canSeeInactive }: { canSeeInactive: boolean }) {
  const product = await prisma.product.findUnique({ where: { id }, include: withCreator });
  if (!product || (!product.isActive && !canSeeInactive)) throw AppError.notFound('Product');
  return product;
}

/** "Nova SSD" → "nova-ssd", or "nova-ssd-2" when taken. */
async function uniqueSlug(name: string, exceptId?: number): Promise<string> {
  const base = slugify(name) || 'product';
  for (let attempt = 1; ; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const taken = await prisma.product.findFirst({
      where: { slug: candidate, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
}

export async function createProduct(input: ProductInput, createdById: number) {
  return prisma.product.create({
    data: { ...input, slug: await uniqueSlug(input.name), createdById },
    include: withCreator,
  });
}

async function assertExists(id: number) {
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!product) throw AppError.notFound('Product');
  return product;
}

export async function replaceProduct(id: number, input: ProductInput) {
  const existing = await assertExists(id);
  const slug = existing.name === input.name ? undefined : await uniqueSlug(input.name, id);
  return prisma.product.update({ where: { id }, data: { ...input, ...(slug ? { slug } : {}) }, include: withCreator });
}

export async function updateProduct(id: number, patch: ProductPatch) {
  const existing = await assertExists(id);
  const slug = patch.name && patch.name !== existing.name ? await uniqueSlug(patch.name, id) : undefined;
  return prisma.product.update({ where: { id }, data: { ...patch, ...(slug ? { slug } : {}) }, include: withCreator });
}

export async function deleteProduct(id: number) {
  await assertExists(id);
  await prisma.product.delete({ where: { id } });
  return { id, deleted: true };
}
