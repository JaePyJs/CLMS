import type { RequestHandler, ErrorRequestHandler } from 'express';
import { AppError, ValidationErrorDetail } from '@/types';
import { logger } from './logger';

interface ErrorResponseBody {
  success: false;
  error: string;
  timestamp: string;
  validationErrors?: ValidationErrorDetail[];
  code?: string;
  stack?: string;
  details?: unknown;
}

// Base AppError class
export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: unknown,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (code !== undefined) {
      this.code = code;
    }
    if (details !== undefined) {
      this.details = details;
    }

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Log the error
    this.log();
  }

  protected log(): void {
    if (this.isOperational) {
      logger.warn('OPERATIONAL_ERROR', {
        message: this.message,
        statusCode: this.statusCode,
        code: this.code,
        details: this.details,
        stack: this.stack,
      });
    } else {
      logger.error('PROGRAM_ERROR', {
        message: this.message,
        statusCode: this.statusCode,
        code: this.code,
        details: this.details,
        stack: this.stack,
      });
    }
  }

  public toJSON(): AppError {
    const result: AppError = {
      name: this.constructor.name,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
    };

    if (this.code !== undefined) {
      result.code = this.code;
    }

    if (this.details !== undefined) {
      result.details = this.details;
    }

    if (process.env.NODE_ENV === 'development' && this.stack !== undefined) {
      result.stack = this.stack;
    }

    return result;
  }
}

// Validation errors
export class ValidationError extends BaseError {
  public readonly validationErrors: ValidationErrorDetail[];

  constructor(message: string, validationErrors: ValidationErrorDetail[]) {
    super(message, 400, true, 'VALIDATION_ERROR', { validationErrors });
    this.validationErrors = validationErrors;
  }
}

// Not found errors
export class NotFoundError extends BaseError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, true, 'NOT_FOUND', { resource, identifier });
  }
}

// Authentication errors
export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

// Authorization errors
export class AuthorizationError extends BaseError {
  constructor(resource: string, action: string) {
    super(
      `You are not authorized to ${action} ${resource}`,
      403,
      true,
      'AUTHORIZATION_ERROR',
      { resource, action },
    );
  }
}

// Conflict errors
export class ConflictError extends BaseError {
  constructor(resource: string, field: string, value: unknown) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      409,
      true,
      'CONFLICT',
      { resource, field, value },
    );
  }
}

// Business logic errors
export class BusinessLogicError extends BaseError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, 422, true, code || 'BUSINESS_LOGIC_ERROR', details);
  }
}

// Database errors
export class DatabaseError extends BaseError {
  constructor(message: string, originalError?: Error, query?: string) {
    super(message, 500, false, 'DATABASE_ERROR', {
      originalError: originalError?.message,
      query,
    });
  }
}

// External service errors
export class ExternalServiceError extends BaseError {
  constructor(service: string, message: string, statusCode: number = 503) {
    super(
      `${service} error: ${message}`,
      statusCode,
      true,
      'EXTERNAL_SERVICE_ERROR',
      { service },
    );
  }
}

// Google Sheets specific errors
export class GoogleSheetsError extends ExternalServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('Google Sheets', message, 503);
    if (details && this.details) {
      Object.assign(this.details, details);
    }
  }
}

// Barcode generation errors
export class BarcodeGenerationError extends BaseError {
  constructor(message: string, format?: string, data?: string) {
    super(
      `Barcode generation failed: ${message}`,
      500,
      true,
      'BARCODE_GENERATION_ERROR',
      { format, data },
    );
  }
}

// Import/Export errors
export class ImportError extends BaseError {
  public readonly importErrors: Array<{
    row: number;
    field?: string;
    message: string;
    value?: unknown;
  }>;
  public readonly partialSuccess: boolean;

  constructor(
    message: string,
    importErrors: Array<{
      row: number;
      field?: string;
      message: string;
      value?: unknown;
    }>,
    partialSuccess: boolean = false,
  ) {
    super(message, 400, true, 'IMPORT_ERROR', { importErrors, partialSuccess });
    this.importErrors = importErrors;
    this.partialSuccess = partialSuccess;
  }
}

// Configuration errors
export class ConfigurationError extends BaseError {
  constructor(configKey: string, message?: string) {
    super(
      message || `Configuration error for key: ${configKey}`,
      500,
      true,
      'CONFIGURATION_ERROR',
      { configKey },
    );
  }
}

// Rate limiting errors
export class RateLimitError extends BaseError {
  constructor(limit: number, windowMs: number) {
    super(
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds allowed.`,
      429,
      true,
      'RATE_LIMIT_ERROR',
      { limit, windowMs },
    );
  }
}

// Time-based errors
export class SessionExpiredError extends BusinessLogicError {
  constructor(sessionType: string, expiryTime: Date) {
    super(
      `${sessionType} session has expired. Session expired at ${expiryTime.toISOString()}`,
      'SESSION_EXPIRED',
      { sessionType, expiryTime },
    );
  }
}

export class TimeLimitExceededError extends BusinessLogicError {
  constructor(resource: string, timeLimit: number, currentTime: number) {
    super(
      `Time limit exceeded for ${resource}. Maximum allowed: ${timeLimit} minutes, current: ${currentTime} minutes`,
      'TIME_LIMIT_EXCEEDED',
      { resource, timeLimit, currentTime },
    );
  }
}

// Equipment specific errors
export class EquipmentUnavailableError extends BusinessLogicError {
  constructor(equipmentId: string, currentStatus: string) {
    super(
      `Equipment ${equipmentId} is not available. Current status: ${currentStatus}`,
      'EQUIPMENT_UNAVAILABLE',
      { equipmentId, currentStatus },
    );
  }
}

export class ConcurrentSessionError extends BusinessLogicError {
  constructor(studentId: string, equipmentType: string) {
    super(
      `Student ${studentId} already has an active ${equipmentType} session`,
      'CONCURRENT_SESSION',
      { studentId, equipmentType },
    );
  }
}

// Student specific errors
export class StudentInactiveError extends BusinessLogicError {
  constructor(studentId: string) {
    super(
      `Student ${studentId} is inactive and cannot use library facilities`,
      'STUDENT_INACTIVE',
      { studentId },
    );
  }
}

export class GradeRestrictionError extends BusinessLogicError {
  constructor(studentGrade: string, requiredGrade: string, resource: string) {
    super(
      `${resource} requires ${requiredGrade} grade level. Student is in ${studentGrade}`,
      'GRADE_RESTRICTION',
      { studentGrade, requiredGrade, resource },
    );
  }
}

// Error factory functions
export const createValidationError = (
  field: string,
  message: string,
  value?: unknown,
) => {
  return new ValidationError('Validation failed', [{ field, message, value }]);
};

export const createNotFoundError = (resource: string, identifier?: string) => {
  return new NotFoundError(resource, identifier);
};

export const createConflictError = (
  resource: string,
  field: string,
  value: unknown,
) => {
  return new ConflictError(resource, field, value);
};

// Error handling utilities
export const isOperationalError = (error: Error): boolean => {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
};

export const getErrorStatusCode = (error: Error): number => {
  if (error instanceof BaseError) {
    return error.statusCode;
  }
  return 500;
};

export const getErrorMessage = (error: Error): string => {
  if (error instanceof BaseError) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Async error wrapper
export const asyncErrorHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error handler middleware
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // Log the error
  if (!(error instanceof BaseError)) {
    logger.error('UNHANDLED_ERROR', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // Determine status code
  const statusCode = getErrorStatusCode(error);
  const message = getErrorMessage(error);

  // Prepare error response
  const errorResponse: ErrorResponseBody = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Add validation errors if present
  if (error instanceof ValidationError) {
    errorResponse.validationErrors = error.validationErrors;
  }

  // Add error code if present
  if (error instanceof BaseError && error.code) {
    errorResponse.code = error.code;
  }

  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    if (error instanceof BaseError && error.details) {
      errorResponse.details = error.details;
    }
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 handler
export const notFoundHandler: RequestHandler = (req, res) => {
  const error = new NotFoundError('Route', `${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
  });
};

// Global error handlers for uncaught exceptions
export const setupGlobalErrorHandlers = (): void => {
  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('UNCAUGHT_EXCEPTION', {
      message: error.message,
      stack: error.stack,
    });

    // Give some time to log before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Unhandled promise rejections
  process.on(
    'unhandledRejection',
    (reason: unknown, promise: Promise<unknown>) => {
      const reasonMessage =
        reason instanceof Error ? reason.message : String(reason);
      const reasonStack = reason instanceof Error ? reason.stack : undefined;

      logger.error('UNHANDLED_REJECTION', {
        reason: reasonMessage,
        stack: reasonStack,
        promise: promise.toString(),
      });

      // Give some time to log before exiting
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    },
  );

  // Warning about unhandled promise rejections
  process.on('warning', (warning: Error) => {
    logger.warn('PROCESS_WARNING', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });
};

export default BaseError;
