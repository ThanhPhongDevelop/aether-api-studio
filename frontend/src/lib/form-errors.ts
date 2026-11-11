import { ApiError } from '@/services/api-client';

export type FieldErrors = Partial<Record<string, string>>;

interface Issue {
  path?: unknown;
  message?: unknown;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Map the API's validation details (`[{ path: 'body.email', message }]`) and
 * conflict details (`{ fields: ['email'] }`) onto form field names.
 */
export function fieldErrorsFrom(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};
  const errors: FieldErrors = {};

  if (Array.isArray(error.details)) {
    for (const issue of error.details as Issue[]) {
      if (typeof issue.path !== 'string' || typeof issue.message !== 'string') continue;
      const field = issue.path.replace(/^(body|query|params)\./, '');
      errors[field] ??= capitalize(issue.message);
    }
  } else if (error.code === 'CONFLICT' && error.details && typeof error.details === 'object') {
    const fields = (error.details as { fields?: unknown }).fields;
    if (Array.isArray(fields)) {
      for (const field of fields) if (typeof field === 'string') errors[field] = `This ${field} is already in use`;
    }
  }
  return errors;
}

/** A one-line description of any thrown value, for toasts and inline alerts. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR') {
      const first = Object.values(fieldErrorsFrom(error))[0];
      return first ? `${error.message}: ${first.toLowerCase()}` : error.message;
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
