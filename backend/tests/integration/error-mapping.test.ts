import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { prisma } from '../../src/config/database.js';
import { normalizeError } from '../../src/middleware/error-handler.js';
import { createUser, resetDatabase } from '../helpers/db.js';

beforeEach(async () => {
  await resetDatabase();
});

describe('normalizeError with the real database', () => {
  it('maps unique constraint violations (P2002) to 409 CONFLICT with the offending fields', async () => {
    await createUser({ email: 'taken@test.dev' });
    const error = await createUser({ email: 'taken@test.dev' }).catch((caught: unknown) => caught);

    const appError = normalizeError(error);
    expect(appError.statusCode).toBe(409);
    expect(appError.code).toBe('CONFLICT');
    expect(appError.details).toEqual({ fields: ['email'] });
  });

  it('maps missing records (P2025) to 404 NOT_FOUND', async () => {
    const error = await prisma.product
      .update({ where: { id: 999_999 }, data: { stock: 1 } })
      .catch((caught: unknown) => caught);
    const appError = normalizeError(error);
    expect(appError.statusCode).toBe(404);
    expect(appError.code).toBe('NOT_FOUND');
  });

  it('enforces foreign keys and cascades deletes', async () => {
    const user = await createUser();
    await prisma.notification.create({ data: { userId: user.id, title: 'Hi', message: 'Hello' } });

    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.userSettings.count({ where: { userId: user.id } })).toBe(0);

    const orphan = await prisma.notification
      .create({ data: { userId: 424_242, title: 'Orphan', message: 'No owner' } })
      .catch((caught: unknown) => caught);
    expect(normalizeError(orphan).statusCode).toBe(409);
  });
});

describe('normalizeError with plain errors', () => {
  it('maps Zod errors to 400 VALIDATION_ERROR', () => {
    const result = z.object({ email: z.email() }).safeParse({ email: 'nope' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const appError = normalizeError(result.error);
    expect(appError.statusCode).toBe(400);
    expect(appError.details).toEqual([expect.objectContaining({ path: 'email' })]);
  });

  it('maps unknown errors to 500 INTERNAL_ERROR', () => {
    const appError = normalizeError(new Error('kaboom'));
    expect(appError.statusCode).toBe(500);
    expect(appError.code).toBe('INTERNAL_ERROR');
    expect(appError.message).toBe('kaboom'); // details are only hidden in production
  });
});
