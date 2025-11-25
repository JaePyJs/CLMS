/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string | undefined;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string | undefined,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, _details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    path: string;
    method: string;
    details?: any;
    stack?: string;
  };
}

// Type guard for Prisma errors
const isPrismaError = (
  error: any,
): error is { code: string; meta?: any; message: string } => {
  return error && typeof error.code === 'string' && error.code.startsWith('P');
};

// Handle different types of errors
const handlePrismaError = (error: {
  code: string;
  meta?: any;
  message: string;
}): AppError => {
  switch (error.code) {
    case 'P2002':
      return new ConflictError(
        `Duplicate entry: ${error.meta?.['target'] || 'unique constraint violation'}`,
      );
    case 'P2025':
      return new NotFoundError('Record');
    case 'P2003':
      return new ValidationError('Foreign key constraint violation');
    case 'P2014':
      return new ValidationError('Invalid ID provided');
    default:
      logger.error('Unhandled Prisma error:', {
        code: error.code,
        message: error.message,
      });
      return new AppError(
        'Database operation failed',
        500,
        true,
        'DATABASE_ERROR',
      );
  }
};

const handleZodError = (error: ZodError): ValidationError => {
  const details = error.issues.map((err: any) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  const message = `Validation failed: ${details.map((d: any) => `${d.field} ${d.message}`).join(', ')}`;

  return new ValidationError(message, details);
};

const handleJWTError = (error: Error): AuthenticationError => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  return new AuthenticationError('Authentication failed');
};

// Main error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let appError: AppError;

  // Convert known errors to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (isPrismaError(error)) {
    appError = handlePrismaError(error);
  } else if (error instanceof ZodError) {
    appError = handleZodError(error);
  } else if (
    error.name === 'JsonWebTokenError' ||
    error.name === 'TokenExpiredError'
  ) {
    appError = handleJWTError(error);
  } else if (error.name === 'MulterError') {
    appError = new ValidationError(`File upload error: ${error.message}`);
  } else {
    // Unknown error
    appError = new AppError(
      env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      500,
      false,
    );
  }

  // Log error
  const errorLog = {
    message: appError.message,
    statusCode: appError.statusCode,
    code: appError.code,
    stack: appError.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
  };

  if (appError.statusCode >= 500) {
    logger.error('Server Error:', errorLog);
  } else {
    logger.warn('Client Error:', errorLog);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message: appError.message,
      ...(appError.code && { code: appError.code }),
      statusCode: appError.statusCode,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
    },
  };

  // Add stack trace in development
  if (env['NODE_ENV'] === 'development' && appError.stack) {
    errorResponse.error.stack = appError.stack;
  }

  // Add details for validation errors
  if (error instanceof ZodError) {
    errorResponse.error.details = error.issues.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  }

  res.status(appError.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

export default errorHandler;
