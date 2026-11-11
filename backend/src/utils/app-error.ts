/** Machine-readable error codes returned in `error.code` of every failed response. */
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  CANNOT_DELETE_SELF: 'CANNOT_DELETE_SELF',
  LAST_ADMIN: 'LAST_ADMIN',
  TARGET_NOT_ALLOWED: 'TARGET_NOT_ALLOWED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

interface AppErrorOptions {
  details?: unknown;
  cause?: unknown;
}

/**
 * An expected, client-facing error. Throw it anywhere (services, controllers,
 * middleware) — the global error handler turns it into the standard envelope:
 * `{ success: false, error: { code, message, details, requestId } }`.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
  }

  /** 5xx messages are internal; only 4xx messages are safe to show to clients. */
  get isClientError(): boolean {
    return this.statusCode < 500;
  }

  static badRequest(message = 'Bad request', details?: unknown): AppError {
    return new AppError(400, ErrorCode.BAD_REQUEST, message, { details });
  }

  static validation(details: unknown, message = 'Request validation failed'): AppError {
    return new AppError(400, ErrorCode.VALIDATION_ERROR, message, { details });
  }

  static unauthorized(message = 'Authentication required', code: ErrorCode = ErrorCode.UNAUTHORIZED): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError(403, ErrorCode.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(404, ErrorCode.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string, details?: unknown, code: ErrorCode = ErrorCode.CONFLICT): AppError {
    return new AppError(409, code, message, { details });
  }

  static serviceUnavailable(message: string, details?: unknown): AppError {
    return new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, message, { details });
  }
}
