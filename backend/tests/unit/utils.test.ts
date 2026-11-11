import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { resolveSqliteUrl } from '../../src/config/database.js';
import { joinRoute } from '../../src/middleware/api-metrics.js';
import { AppError, ErrorCode } from '../../src/utils/app-error.js';
import { percentage, roundTo, slugify } from '../../src/utils/format.js';
import { formatZodIssues } from '../../src/utils/validation.js';

describe('format utils', () => {
  it('slugifies text, including Vietnamese diacritics', () => {
    expect(slugify('Bàn phím Cơ Đỏ')).toBe('ban-phim-co-do');
    expect(slugify('  Photon 27" 4K Monitor!  ')).toBe('photon-27-4k-monitor');
  });

  it('rounds to a given precision', () => {
    expect(roundTo(3.14159)).toBe(3.14);
    expect(roundTo(3.14159, 3)).toBe(3.142);
  });

  it('computes percentages safely', () => {
    expect(percentage(1, 3)).toBe(33.3);
    expect(percentage(5, 0)).toBe(0);
  });
});

describe('resolveSqliteUrl', () => {
  const base = path.resolve('/srv/app/backend');

  it('resolves relative paths against the base directory', () => {
    expect(resolveSqliteUrl('file:./data/app.db', base)).toBe(`file:${path.join(base, 'data', 'app.db')}`);
  });

  it('keeps absolute paths, in-memory databases and non-file URLs untouched', () => {
    const absolute = `file:${path.resolve('/var/db/app.db')}`;
    expect(resolveSqliteUrl(absolute, base)).toBe(absolute);
    expect(resolveSqliteUrl('file::memory:', base)).toBe('file::memory:');
    expect(resolveSqliteUrl('postgresql://localhost/db', base)).toBe('postgresql://localhost/db');
  });
});

describe('joinRoute', () => {
  it('builds clean route patterns', () => {
    expect(joinRoute('/api', '/')).toBe('/api');
    expect(joinRoute('/api/users', '/:id')).toBe('/api/users/:id');
    expect(joinRoute('', '/')).toBe('/');
  });
});

describe('AppError', () => {
  it('exposes status, code and details through factories', () => {
    const error = AppError.validation([{ path: 'body.email', message: 'Invalid email', code: 'invalid_format' }]);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.details).toHaveLength(1);
    expect(error.isClientError).toBe(true);
  });

  it('builds the common HTTP errors', () => {
    expect(AppError.unauthorized().statusCode).toBe(401);
    expect(AppError.forbidden().statusCode).toBe(403);
    expect(AppError.notFound('Product').message).toBe('Product not found');
    expect(AppError.conflict('Taken').statusCode).toBe(409);
    expect(AppError.serviceUnavailable('Down').isClientError).toBe(false);
  });
});

describe('formatZodIssues', () => {
  it('flattens issues with a location prefix', () => {
    const result = z.object({ email: z.email(), age: z.number().min(18) }).safeParse({ email: 'nope', age: 3 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issues = formatZodIssues(result.error, 'body');
    expect(issues.map((issue) => issue.path)).toEqual(['body.email', 'body.age']);
  });
});
