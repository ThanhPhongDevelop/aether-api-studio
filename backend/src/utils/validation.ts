import type { ZodError } from 'zod';

export interface ValidationIssue {
  /** Dot-separated location, e.g. `body.email` or `query.page`. */
  path: string;
  message: string;
  code: string;
}

/** Convert Zod issues into a flat, client-friendly list. */
export function formatZodIssues(error: ZodError, prefix?: string): ValidationIssue[] {
  return error.issues.map((issue) => {
    const segments = [prefix, ...issue.path.map(String)].filter(Boolean);
    return { path: segments.join('.') || '(root)', message: issue.message, code: issue.code };
  });
}
