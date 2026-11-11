import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError, ErrorCode } from '../utils/app-error.js';
import type { ApiFailure } from '../utils/http-response.js';
import { formatZodIssues } from '../utils/validation.js';

/** Shape of errors thrown by body-parser / http-errors. */
interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

function isHttpError(error: unknown): error is HttpError {
  if (!(error instanceof Error)) return false;
  const { status, statusCode } = error as HttpError;
  return typeof status === 'number' || typeof statusCode === 'number';
}

/** Unique-constraint fields, whether reported by the classic engine or a driver adapter. */
function uniqueFields(error: Prisma.PrismaClientKnownRequestError): unknown {
  const meta = error.meta as
    { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
  return meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields;
}

function fromPrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002':
      return AppError.conflict('A record with the same unique value already exists', { fields: uniqueFields(error) });
    case 'P2003':
      return AppError.conflict('The operation violates a relation constraint');
    case 'P2025':
      return AppError.notFound('Record');
    default:
      return new AppError(
        500,
        ErrorCode.INTERNAL_ERROR,
        isProduction ? 'Database error' : `Database error ${error.code}`,
        {
          cause: error,
        },
      );
  }
}

/** Map any thrown value to an AppError with a safe, client-facing message. */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return AppError.validation(formatZodIssues(error));
  if (error instanceof Prisma.PrismaClientKnownRequestError) return fromPrismaError(error);

  if (isHttpError(error)) {
    const status = error.status ?? error.statusCode ?? 500;
    switch (error.type) {
      case 'entity.parse.failed':
        return new AppError(400, ErrorCode.INVALID_JSON, 'Malformed JSON in request body', { cause: error });
      case 'entity.too.large':
        return new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, 'Request body is too large', { cause: error });
      case 'encoding.unsupported':
      case 'charset.unsupported':
        return new AppError(415, ErrorCode.UNSUPPORTED_MEDIA_TYPE, error.message, { cause: error });
      default:
        if (status >= 400 && status < 500) {
          const message = error.expose === false ? 'Bad request' : error.message;
          return new AppError(status, ErrorCode.BAD_REQUEST, message, { cause: error });
        }
    }
  }

  const message = !isProduction && error instanceof Error ? error.message : 'An unexpected error occurred';
  return new AppError(500, ErrorCode.INTERNAL_ERROR, message, { cause: error });
}

/** Last middleware in the chain: renders every error as the standard JSON envelope. */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const appError = normalizeError(error);
  // Attach unexpected errors to the response so pino-http logs them with the stack trace.
  if (appError.statusCode >= 500) res.err = error instanceof Error ? error : new Error(String(error));

  const body: ApiFailure = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details }),
      requestId: String(req.id),
    },
  };
  res.status(appError.statusCode).json(body);
};
