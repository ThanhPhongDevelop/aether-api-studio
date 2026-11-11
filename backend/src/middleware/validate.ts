import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/app-error.js';
import { formatZodIssues, type ValidationIssue } from '../utils/validation.js';

export interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

const PARTS = ['params', 'query', 'body'] as const;

/**
 * Validate (and coerce) request parts with Zod. All issues from every part are
 * reported together as a 400 VALIDATION_ERROR.
 *
 * Parsed values replace `req.body` / `req.params`; because `req.query` is a
 * read-only getter in Express 5, every parsed part is also exposed on
 * `res.locals.validated`.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, res, next) => {
    const issues: ValidationIssue[] = [];
    const validated: NonNullable<typeof res.locals.validated> = {};

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) validated[part] = result.data;
      else issues.push(...formatZodIssues(result.error, part));
    }

    if (issues.length > 0) return next(AppError.validation(issues));

    if ('body' in validated) req.body = validated.body;
    if ('params' in validated) req.params = validated.params as typeof req.params;
    res.locals.validated = validated;
    next();
  };
}
