import { logger } from '@/utils/logger';

// Base error class
export abstract class CLMSError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly isOperational: boolean;
  public abstract readonly code: string;

  constructor(message: string, public readonly context?: any) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  // Log error when thrown
  logError(): void {
    logger.error('CLMS Error occurred', {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
    });
  }
}

// Validation errors
export class ValidationError extends CLMSError {
  public readonly statusCode = 400;
  public readonly isOperational = true;
  public readonly code = 'VALIDATION_ERROR';

  constructor(message: string, public readonly validationErrors?: any[], context?: any) {
    super(message, context);
  }
}

// Authentication errors
export class AuthenticationError extends CLMSError {
  public readonly statusCode = 401;
  public readonly isOperational = true;
  public readonly code = 'AUTHENTICATION_ERROR';

  constructor(message = 'Authentication failed', context?: any) {
    super(message, context);
  }
}

// Authorization errors
export class AuthorizationError extends CLMSError {
  public readonly statusCode = 403;
  public readonly isOperational = true;
  public readonly code = 'AUTHORIZATION_ERROR';

  constructor(message = 'Access denied', context?: any) {
    super(message, context);
  }
}

// Not found errors
export class NotFoundError extends CLMSError {
  public readonly statusCode = 404;
  public readonly isOperational = true;
  public readonly code = 'NOT_FOUND_ERROR';

  constructor(resource: string, identifier?: string, context?: any) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, context);
  }
}

// Conflict errors
export class ConflictError extends CLMSError {
  public readonly statusCode = 409;
  public readonly isOperational = true;
  public readonly code = 'CONFLICT_ERROR';

  constructor(message: string, context?: any) {
    super(message, context);
  }
}

// Rate limiting errors
export class RateLimitError extends CLMSError {
  public readonly statusCode = 429;
  public readonly isOperational = true;
  public readonly code = 'RATE_LIMIT_ERROR';

  constructor(message = 'Rate limit exceeded', public readonly retryAfter?: number, context?: any) {
    super(message, context);
  }
}

// Database errors
export class DatabaseError extends CLMSError {
  public readonly statusCode = 500;
  public readonly isOperational = true;
  public readonly code = 'DATABASE_ERROR';

  constructor(message = 'Database operation failed', public readonly originalError?: Error, context?: any) {
    super(message, context);
  }
}

// External service errors
export class ExternalServiceError extends CLMSError {
  public readonly statusCode = 502;
  public readonly isOperational = true;
  public readonly code = 'EXTERNAL_SERVICE_ERROR';

  constructor(service: string, message?: string, context?: any) {
    super(message || `External service ${service} unavailable`, context);
  }
}

// Configuration errors
export class ConfigurationError extends CLMSError {
  public readonly statusCode = 500;
  public readonly isOperational = false;
  public readonly code = 'CONFIGURATION_ERROR';

  constructor(message: string, context?: any) {
    super(message, context);
  }
}

// FERPA compliance errors
export class FERPAComplianceError extends CLMSError {
  public readonly statusCode = 403;
  public readonly isOperational = true;
  public readonly code = 'FERPA_COMPLIANCE_ERROR';

  constructor(message = 'FERPA compliance violation', context?: any) {
    super(message, context);
  }
}

// Generic internal server error
export class InternalServerError extends CLMSError {
  public readonly statusCode = 500;
  public readonly isOperational = false;
  public readonly code = 'INTERNAL_SERVER_ERROR';

  constructor(message = 'Internal server error', public readonly originalError?: Error, context?: any) {
    super(message, context);
  }
}

// Error factory function
export class ErrorFactory {
  static createError(error: any, context?: any): CLMSError {
    // If it's already a CLMS error, return it
    if (error instanceof CLMSError) {
      return error;
    }

    // Handle Prisma errors
    if (error?.code?.startsWith('P')) {
      return this.handlePrismaError(error, context);
    }

    // Handle JWT errors
    if (error?.name === 'JsonWebTokenError') {
      return new AuthenticationError('Invalid authentication token', context);
    }

    if (error?.name === 'TokenExpiredError') {
      return new AuthenticationError('Authentication token expired', context);
    }

    // Handle validation errors
    if (error?.name === 'ValidationError') {
      return new ValidationError(error.message, error.details, context);
    }

    // Handle network errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      return new ExternalServiceError('Unknown service', error.message, context);
    }

    // Default to internal server error
    return new InternalServerError(
      error?.message || 'An unexpected error occurred',
      error,
      context
    );
  }

  private static handlePrismaError(error: any, context?: any): CLMSError {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        return new ConflictError(
          'A record with this value already exists',
          { field: error.meta?.target, ...context }
        );

      case 'P2025':
        // Record not found
        return new NotFoundError(
          'Record',
          error.meta?.cause,
          context
        );

      case 'P2003':
        // Foreign key constraint violation
        return new ValidationError(
          'Referenced record does not exist',
          [{ field: error.meta?.field_name, message: 'Invalid reference' }],
          context
        );

      case 'P2014':
        // Relation violation
        return new ConflictError(
          'Cannot delete or update due to existing relations',
          { relation: error.meta?.relation_name, ...context }
        );

      default:
        return new DatabaseError(
          'Database operation failed',
          error,
          context
        );
    }
  }
}

// Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

// Development vs production error details
export function getErrorResponse(error: CLMSError, requestId?: string): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(isDevelopment && {
        details: {
          context: error.context,
          stack: error.stack,
          validationErrors: error instanceof ValidationError ? error.validationErrors : undefined,
        }
      }),
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
  };
}