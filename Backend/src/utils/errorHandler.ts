import { logger } from './logger';

/**
 * Standardized error handling utilities for consistent error management
 * across the CLMS backend services.
 */

export interface ErrorContext {
  [key: string]: unknown;
}

export interface ErrorHandlerOptions {
  rethrow?: boolean;
  fallbackValue?: unknown;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  context?: ErrorContext;
}

/**
 * Standard error handler with consistent logging and optional fallback values
 */
export function handleError(
  error: unknown,
  operation: string,
  options: ErrorHandlerOptions = {}
): void {
  const {
    rethrow = false,
    logLevel = 'error',
    context = {}
  } = options;

  const errorInfo = {
    operation,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  };

  switch (logLevel) {
    case 'error':
      logger.error(`Operation failed: ${operation}`, errorInfo);
      break;
    case 'warn':
      logger.warn(`Operation warning: ${operation}`, errorInfo);
      break;
    case 'info':
      logger.info(`Operation info: ${operation}`, errorInfo);
      break;
    case 'debug':
      logger.debug(`Operation debug: ${operation}`, errorInfo);
      break;
  }

  if (rethrow) {
    throw error;
  }
}

/**
 * Async error wrapper for consistent async error handling
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: ErrorHandlerOptions & { fallbackValue?: T } = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, operationName, options);
    
    if ('fallbackValue' in options) {
      return options.fallbackValue as T;
    }
    
    if (options.rethrow) {
      throw error;
    }
    
    // Return undefined if no fallback provided and not rethrowing
    return undefined as T;
  }
}

/**
 * Sync error wrapper for consistent sync error handling
 */
export function handleSyncError<T>(
  operation: () => T,
  operationName: string,
  options: ErrorHandlerOptions & { fallbackValue?: T } = {}
): T {
  try {
    return operation();
  } catch (error) {
    handleError(error, operationName, options);
    
    if ('fallbackValue' in options) {
      return options.fallbackValue as T;
    }
    
    if (options.rethrow) {
      throw error;
    }
    
    // Return undefined if no fallback provided and not rethrowing
    return undefined as T;
  }
}

/**
 * Service-specific error handlers for common patterns
 */
export class ServiceErrorHandler {
  constructor(private serviceName: string) {}

  /**
   * Handle database operation errors with consistent logging
   */
  handleDatabaseError(error: unknown, operation: string, context?: ErrorContext): void {
    handleError(error, `${this.serviceName}.${operation}`, {
      logLevel: 'error',
      context: { type: 'database', ...context }
    });
  }

  /**
   * Handle validation errors with consistent logging
   */
  handleValidationError(error: unknown, operation: string, context?: ErrorContext): void {
    handleError(error, `${this.serviceName}.${operation}`, {
      logLevel: 'warn',
      context: { type: 'validation', ...context }
    });
  }

  /**
   * Handle external service errors with consistent logging
   */
  handleExternalServiceError(error: unknown, operation: string, context?: ErrorContext): void {
    handleError(error, `${this.serviceName}.${operation}`, {
      logLevel: 'error',
      context: { type: 'external_service', ...context }
    });
  }

  /**
   * Handle authentication/authorization errors
   */
  handleAuthError(error: unknown, operation: string, context?: ErrorContext): void {
    handleError(error, `${this.serviceName}.${operation}`, {
      logLevel: 'warn',
      context: { type: 'auth', ...context }
    });
  }

  /**
   * Handle business logic errors
   */
  handleBusinessError(error: unknown, operation: string, context?: ErrorContext): void {
    handleError(error, `${this.serviceName}.${operation}`, {
      logLevel: 'warn',
      context: { type: 'business_logic', ...context }
    });
  }

  /**
   * Generic error handler with context
   */
  handleError(error: unknown, operation: string, context?: ErrorContext): void {
    handleError(error, `${this.serviceName}.${operation}`, {
      logLevel: 'error',
      ...(context && { context })
    });
  }
}

/**
 * Create a service-specific error handler
 */
export function createServiceErrorHandler(serviceName: string): ServiceErrorHandler {
  return new ServiceErrorHandler(serviceName);
}

/**
 * Common error handling patterns for specific operations
 */
export const ErrorPatterns = {
  /**
   * Handle duplicate check operations (return false on error)
   */
  duplicateCheck: (error: unknown, operation: string, context?: ErrorContext): boolean => {
    handleError(error, operation, {
      logLevel: 'error',
      context: { type: 'duplicate_check', ...context }
    });
    return false;
  },

  /**
   * Handle notification operations (don't fail the main flow)
   */
  notification: (error: unknown, operation: string, context?: ErrorContext): void => {
    handleError(error, operation, {
      logLevel: 'warn',
      context: { type: 'notification', ...context }
    });
  },

  /**
   * Handle cleanup operations (don't fail the main flow)
   */
  cleanup: (error: unknown, operation: string, context?: ErrorContext): void => {
    handleError(error, operation, {
      logLevel: 'warn',
      context: { type: 'cleanup', ...context }
    });
  },

  /**
   * Handle cache operations (return null on error)
   */
  cache: <T>(error: unknown, operation: string, context?: ErrorContext): T | null => {
    handleError(error, operation, {
      logLevel: 'warn',
      context: { type: 'cache', ...context }
    });
    return null;
  },

  /**
   * Handle critical operations (always rethrow)
   */
  critical: (error: unknown, operation: string, context?: ErrorContext): never => {
    handleError(error, operation, {
      logLevel: 'error',
      rethrow: true,
      context: { type: 'critical', ...context }
    });
    throw error;
  }
};

/**
 * Decorator for automatic error handling on methods
 */
export function withErrorHandling(options: ErrorHandlerOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        const operationName = `${target.constructor.name}.${propertyName}`;
        handleError(error, operationName, {
          ...options,
          context: { 
            method: propertyName, 
            className: target.constructor.name,
            args: args.length,
            ...options.context 
          }
        });

        if (options.rethrow) {
          throw error;
        }

        if ('fallbackValue' in options) {
          return options.fallbackValue;
        }

        // Return undefined for async methods if no fallback
        return undefined;
      }
    };

    return descriptor;
  };
}

/**
 * Batch error handler for processing multiple operations
 */
export class BatchErrorHandler {
  private errors: Array<{ error: unknown; operation: string; context?: ErrorContext }> = [];

  /**
   * Add an error to the batch
   */
  addError(error: unknown, operation: string, context?: ErrorContext): void {
    this.errors.push({ 
      error, 
      operation, 
      ...(context && { context })
    });
  }

  /**
   * Process an operation and catch any errors
   */
  async processOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: ErrorContext
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.addError(error, operationName, context);
      return null;
    }
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get all errors
   */
  getErrors(): Array<{ error: unknown; operation: string; context?: ErrorContext }> {
    return [...this.errors];
  }

  /**
   * Log all errors and clear the batch
   */
  flushAndLog(): void {
    if (this.errors.length > 0) {
      logger.error('Batch operation errors', {
        errorCount: this.errors.length,
        errors: this.errors.map(e => ({
          operation: e.operation,
          error: e.error instanceof Error ? e.error.message : String(e.error),
          context: e.context
        }))
      });
      this.errors = [];
    }
  }
}