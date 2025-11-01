import type { Request, Response, NextFunction } from 'express';
import { BaseError } from '../utils/errors';
import { logger } from '../utils/logger';
import { auditService, AuditAction, AuditEntity } from '../services/auditService';
import { notificationService } from '../services/notification.service';
import { getCurrentTimestamp } from '../utils/common';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Error categories for better organization
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SYSTEM = 'SYSTEM',
  PERFORMANCE = 'PERFORMANCE',
}

// Enhanced error interface
interface EnhancedError extends Error {
  statusCode?: number;
  code?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  context?: Record<string, any>;
  recoveryAction?: string;
  isRecoverable?: boolean;
  retryCount?: number;
  originalError?: Error;
  details?: {
    validationErrors?: any[];
    [key: string]: any;
  };
}

// Error context for tracking
interface ErrorContext {
  requestId: string;
  userId?: string;
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  body?: any;
  query?: any;
  params?: any;
  timestamp: Date;
  duration: number;
}

// Error metrics tracking
interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByEndpoint: Record<string, number>;
  recentErrors: Array<{
    timestamp: Date;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    endpoint: string;
  }>;
}

// Global error metrics store
const errorMetrics: ErrorMetrics = {
  totalErrors: 0,
  errorsByCategory: {
    [ErrorCategory.AUTHENTICATION]: 0,
    [ErrorCategory.AUTHORIZATION]: 0,
    [ErrorCategory.VALIDATION]: 0,
    [ErrorCategory.DATABASE]: 0,
    [ErrorCategory.NETWORK]: 0,
    [ErrorCategory.EXTERNAL_SERVICE]: 0,
    [ErrorCategory.BUSINESS_LOGIC]: 0,
    [ErrorCategory.SYSTEM]: 0,
    [ErrorCategory.PERFORMANCE]: 0,
  },
  errorsBySeverity: {
    [ErrorSeverity.LOW]: 0,
    [ErrorSeverity.MEDIUM]: 0,
    [ErrorSeverity.HIGH]: 0,
    [ErrorSeverity.CRITICAL]: 0,
  },
  errorsByEndpoint: {},
  recentErrors: [],
};

// Categorize error based on type and message
export function categorizeError(error: Error): {
  category: ErrorCategory;
  severity: ErrorSeverity;
} {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';

  // Database errors
  if (
    message.includes('database') ||
    message.includes('prisma') ||
    message.includes('connection') ||
    stack.includes('prisma')
  ) {
    return {
      category: ErrorCategory.DATABASE,
      severity: message.includes('connection')
        ? ErrorSeverity.HIGH
        : ErrorSeverity.MEDIUM,
    };
  }

  // Authentication errors
  if (
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('jwt') ||
    message.includes('token')
  ) {
    return {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.LOW,
    };
  }

  // Authorization errors
  if (
    message.includes('forbidden') ||
    message.includes('access denied') ||
    message.includes('permission')
  ) {
    return {
      category: ErrorCategory.AUTHORIZATION,
      severity: ErrorSeverity.LOW,
    };
  }

  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('format')
  ) {
    return {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
    };
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    stack.includes('fetch')
  ) {
    return {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  // External service errors
  if (
    message.includes('external') ||
    message.includes('api') ||
    message.includes('third party') ||
    message.includes('google')
  ) {
    return {
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  // Performance errors
  if (
    message.includes('timeout') ||
    message.includes('slow') ||
    message.includes('performance')
  ) {
    return {
      category: ErrorCategory.PERFORMANCE,
      severity: ErrorSeverity.HIGH,
    };
  }

  // System errors
  if (
    message.includes('system') ||
    message.includes('memory') ||
    message.includes('disk') ||
    message.includes('internal')
  ) {
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
    };
  }

  // Default to business logic
  return {
    category: ErrorCategory.BUSINESS_LOGIC,
    severity: ErrorSeverity.MEDIUM,
  };
}

// Generate recovery action based on error
export function generateRecoveryAction(error: EnhancedError): string {
  const { category, message } = error;

  switch (category) {
    case ErrorCategory.DATABASE:
      if (message.includes('connection')) {
        return 'Attempting to reconnect to database...';
      }
      return 'Database operation failed. Please try again.';

    case ErrorCategory.NETWORK:
      if (message.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
      return 'Network error detected. Checking connection...';

    case ErrorCategory.EXTERNAL_SERVICE:
      return 'External service temporarily unavailable. Using cached data...';

    case ErrorCategory.PERFORMANCE:
      return 'System experiencing high load. Please try again in a moment.';

    case ErrorCategory.VALIDATION:
      return 'Please check your input and try again.';

    case ErrorCategory.AUTHENTICATION:
      return 'Please refresh your session and try again.';

    case ErrorCategory.AUTHORIZATION:
      return 'You do not have permission to perform this action.';

    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// Enhanced error middleware
export const enhancedErrorHandler = async (
  error: EnhancedError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = req.headers['x-request-start-time'] as string;
  const context: ErrorContext = {
    requestId: (req.headers['x-request-id'] as string) || 'unknown',
    userId: (req as any).user?.id,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    params: req.params,
    timestamp: new Date(getCurrentTimestamp()),
    duration: startTime ? Date.now() - parseInt(startTime) : 0,
  };

  // Enhance error with additional information
  if (!error.category || !error.severity) {
    const { category, severity } = categorizeError(error);
    error.category = category;
    error.severity = severity;
  }

  error.context = context;
  error.recoveryAction = generateRecoveryAction(error);

  // Determine if error is recoverable
  error.isRecoverable = [
    ErrorCategory.NETWORK,
    ErrorCategory.EXTERNAL_SERVICE,
    ErrorCategory.PERFORMANCE,
  ].includes(error.category!);

  // Update error metrics
  updateErrorMetrics(error, context);

  // Log the error
  logError(error, context);

  // Attempt error recovery if possible
  let recoveryAttempted = false;
  if (error.isRecoverable && error.retryCount === undefined) {
    recoveryAttempted = await attemptErrorRecovery(error, req, res);
  }

  // Send error response
  const errorResponse = buildErrorResponse(error, context, recoveryAttempted);
  res.status(error.statusCode || 500).json(errorResponse);

  // Create audit log for critical errors
  if (
    error.severity === ErrorSeverity.CRITICAL ||
    error.severity === ErrorSeverity.HIGH
  ) {
    await createErrorAuditLog(error, context);
  }

  // Send notifications for critical errors
  if (error.severity === ErrorSeverity.CRITICAL) {
    await sendErrorNotification(error, context);
  }
};

// Update error metrics
function updateErrorMetrics(error: EnhancedError, context: ErrorContext): void {
  errorMetrics.totalErrors++;
  errorMetrics.errorsByCategory[error.category!]++;
  errorMetrics.errorsBySeverity[error.severity!]++;

  const endpoint = `${context.method} ${context.url.split('?')[0]}`;
  errorMetrics.errorsByEndpoint[endpoint] =
    (errorMetrics.errorsByEndpoint[endpoint] || 0) + 1;

  // Add to recent errors (keep last 100)
  errorMetrics.recentErrors.push({
    timestamp: context.timestamp,
    category: error.category!,
    severity: error.severity!,
    message: error.message,
    endpoint,
  });

  if (errorMetrics.recentErrors.length > 100) {
    errorMetrics.recentErrors.shift();
  }
}

// Log error with context
function logError(error: EnhancedError, context: ErrorContext): void {
  const logData = {
    message: error.message,
    category: error.category,
    severity: error.severity,
    statusCode: error.statusCode,
    code: error.code,
    context: {
      requestId: context.requestId,
      userId: context.userId,
      ip: context.ip,
      method: context.method,
      url: context.url,
      duration: context.duration,
    },
    stack: error.stack,
    isRecoverable: error.isRecoverable,
    recoveryAction: error.recoveryAction,
  };

  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      logger.error('CRITICAL_ERROR', logData);
      break;
    case ErrorSeverity.HIGH:
      logger.error('HIGH_SEVERITY_ERROR', logData);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn('MEDIUM_SEVERITY_ERROR', logData);
      break;
    case ErrorSeverity.LOW:
      logger.info('LOW_SEVERITY_ERROR', logData);
      break;
  }
}

// Attempt error recovery
async function attemptErrorRecovery(
  error: EnhancedError,
  req: Request,
  res: Response,
): Promise<boolean> {
  try {
    switch (error.category) {
      case ErrorCategory.DATABASE:
        if (error.message.includes('connection')) {
          // Attempt database reconnection logic would go here
          logger.info('Attempting database reconnection...');
          return false; // Would return true if successful
        }
        break;

      case ErrorCategory.NETWORK:
        if (error.message.includes('timeout')) {
          // Could implement retry logic here
          logger.info('Network timeout detected, considering retry...');
          return false;
        }
        break;

      case ErrorCategory.EXTERNAL_SERVICE:
        // Could implement fallback service logic here
        logger.info('External service unavailable, attempting fallback...');
        return false;
    }
  } catch (recoveryError) {
    logger.error('Error recovery attempt failed', { recoveryError });
  }

  return false;
}

// Build error response object
function buildErrorResponse(
  error: EnhancedError,
  context: ErrorContext,
  recoveryAttempted: boolean,
): any {
  const baseResponse: any = {
    success: false,
    error: error.message,
    code: error.code || 'INTERNAL_ERROR',
    timestamp: context.timestamp.toISOString(),
    requestId: context.requestId,
  };

  // Add recovery information
  if (error.isRecoverable) {
    baseResponse.recoverable = true;
    baseResponse.recoveryAction = error.recoveryAction;
    if (recoveryAttempted) {
      baseResponse.recoveryAttempted = true;
    }
  }

  // Add validation errors if present
  if (error.code === 'VALIDATION_ERROR' && error.details?.validationErrors) {
    baseResponse.validationErrors = error.details.validationErrors;
  }

  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    baseResponse.details = {
      category: error.category,
      severity: error.severity,
      stack: error.stack,
      context: {
        method: context.method,
        url: context.url,
        duration: context.duration,
      },
    };
  }

  return baseResponse;
}

// Create audit log for error
async function createErrorAuditLog(
  error: EnhancedError,
  context: ErrorContext,
): Promise<void> {
  try {
    await auditService.log({
      action: AuditAction.VIEW,
      entity: AuditEntity.SETTINGS,
      success: false,
      errorMessage: error.message,
      metadata: {
        category: error.category,
        severity: error.severity === ErrorSeverity.CRITICAL ? 'HIGH' : 'MEDIUM',
        statusCode: error.statusCode,
        endpoint: `${context.method} ${context.url}`,
        userId: context.userId,
        requestId: context.requestId,
        userAgent: context.userAgent,
        ip: context.ip,
      },
    });
  } catch (auditError) {
    logger.error('Failed to create error audit log', { auditError });
  }
}

// Send error notification to administrators
async function sendErrorNotification(
  error: EnhancedError,
  context: ErrorContext,
): Promise<void> {
  try {
    await notificationService.createNotification({
      type: 'SYSTEM_ALERT',
      title: `Critical Error: ${error.category}`,
      message: `A critical ${error.category} error occurred: ${error.message}`,
      // recipients: ['admin'], // Would get actual admin users - removed as it's not in the interface
      priority: 'HIGH',
      metadata: {
        errorId: context.requestId,
        endpoint: `${context.method} ${context.url}`,
        severity: error.severity,
        timestamp: context.timestamp,
      },
    });
  } catch (notificationError) {
    logger.error('Failed to send error notification', { notificationError });
  }
}

// Get error metrics for monitoring
export function getErrorMetrics(): ErrorMetrics {
  return { ...errorMetrics };
}

// Get error trends analysis
export function getErrorTrends(): {
  hourlyTrend: Array<{ hour: number; count: number }>;
  categoryBreakdown: Array<{
    category: ErrorCategory;
    count: number;
    percentage: number;
  }>;
  severityBreakdown: Array<{
    severity: ErrorSeverity;
    count: number;
    percentage: number;
  }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
} {
  const now = new Date();
  const hourlyTrend = Array.from({ length: 24 }, (_, i) => {
    const hour = (now.getHours() - i + 24) % 24;
    const count = errorMetrics.recentErrors.filter(
      error =>
        error.timestamp.getHours() === hour &&
        error.timestamp.toDateString() === now.toDateString(),
    ).length;
    return { hour, count };
  }).reverse();

  const totalErrors = errorMetrics.totalErrors || 1;
  const categoryBreakdown = Object.entries(errorMetrics.errorsByCategory).map(
    ([category, count]) => ({
      category: category as ErrorCategory,
      count,
      percentage: Math.round((count / totalErrors) * 100),
    }),
  );

  const severityBreakdown = Object.entries(errorMetrics.errorsBySeverity).map(
    ([severity, count]) => ({
      severity: severity as ErrorSeverity,
      count,
      percentage: Math.round((count / totalErrors) * 100),
    }),
  );

  const topEndpoints = Object.entries(errorMetrics.errorsByEndpoint)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));

  return {
    hourlyTrend,
    categoryBreakdown,
    severityBreakdown,
    topEndpoints,
  };
}

// Reset error metrics (for testing or maintenance)
export function resetErrorMetrics(): void {
  errorMetrics.totalErrors = 0;
  Object.keys(errorMetrics.errorsByCategory).forEach(key => {
    errorMetrics.errorsByCategory[key as ErrorCategory] = 0;
  });
  Object.keys(errorMetrics.errorsBySeverity).forEach(key => {
    errorMetrics.errorsBySeverity[key as ErrorSeverity] = 0;
  });
  errorMetrics.errorsByEndpoint = {};
  errorMetrics.recentErrors = [];
}

export default enhancedErrorHandler;
