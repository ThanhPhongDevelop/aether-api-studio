import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../../src/middleware/validate.js';
import { AppError } from '../../src/utils/app-error.js';

function run(middleware: ReturnType<typeof validate>, req: Partial<Request>) {
  const res = { locals: {} } as Response;
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  middleware(req as Request, res, next);
  return { res, next };
}

const schemas = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  body: z.object({ name: z.string().trim().min(2) }),
};

describe('validate middleware', () => {
  it('passes coerced values through on success', () => {
    const req: Partial<Request> = { params: { id: '7' }, query: {}, body: { name: '  Aether  ' } };
    const { res, next } = run(validate(schemas), req);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Aether' });
    expect(req.params).toEqual({ id: 7 });
    expect(res.locals.validated?.query).toEqual({ page: 1 });
  });

  it('reports every invalid part in a single 400 error', () => {
    const req: Partial<Request> = { params: { id: 'abc' }, query: { page: '0' }, body: {} };
    const { next } = run(validate(schemas), req);

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    const paths = (error.details as Array<{ path: string }>).map((issue) => issue.path);
    expect(paths).toEqual(['params.id', 'query.page', 'body.name']);
  });

  it('treats a missing body as an empty object', () => {
    const { next } = run(validate({ body: schemas.body }), { body: undefined });
    expect((next.mock.calls[0]?.[0] as AppError).details).toEqual([expect.objectContaining({ path: 'body.name' })]);
  });
});
