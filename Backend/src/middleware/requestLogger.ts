import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Extend Express Request to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

interface LogContext {
  requestId: string;
  method: string;
  url: string;
  userId?: string;
  ip: string;
  userAgent: string;
  duration?: number;
  statusCode?: number;
  error?: string;
}

/**
 * Request logging middleware
 * Logs all incoming requests with detailed context
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Extract request context
  const context: LogContext = {
    requestId: req.requestId || 'unknown',
    method: req.method,
    url: req.originalUrl || req.url,
    userId: (req as any).user?.id,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
  };

  // Log incoming request
  logger.info('Incoming request', {
    ...context,
    body: sanitizeBody(req.body),
    query: req.query,
    params: req.params,
  });

  // Capture response
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send
  res.send = function (data: any) {
    res.send = originalSend;
    logResponse(req, res, context);
    return originalSend.call(this, data);
  };

  // Override res.json
  res.json = function (data: any) {
    res.json = originalJson;
    logResponse(req, res, context);
    return originalJson.call(this, data);
  };

  // Handle response finish event
  res.on('finish', () => {
    logResponse(req, res, context);
  });

  next();
};

/**
 * Log response details
 */
function logResponse(req: Request, res: Response, context: LogContext) {
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  const statusCode = res.statusCode;

  const logData = {
    ...context,
    duration: `${duration}ms`,
    statusCode,
    success: statusCode < 400,
  };

  // Log based on status code
  if (statusCode >= 500) {
    logger.error('Request failed with server error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Request failed with client error', logData);
  } else if (duration > 5000) {
    logger.warn('Slow request detected', logData);
  } else {
    logger.info('Request completed', logData);
  }
}

/**
 * Sanitize sensitive data from request body
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'accessToken',
    'refreshToken',
    'creditCard',
    'ssn',
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * Error logging middleware
 * Logs all unhandled errors with full context
 */
export const errorLogger = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const duration = req.startTime ? Date.now() - req.startTime : 0;

  const errorContext = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    userId: (req as any).user?.id,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    duration: `${duration}ms`,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  };

  logger.error('Unhandled error', errorContext);

  next(err);
};

/**
 * Performance monitoring middleware
 * Tracks slow endpoints and query performance
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests (over 3 seconds)
    if (duration > 3000) {
      logger.warn('Performance warning: Slow endpoint', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }

    // Track endpoint metrics (could be sent to monitoring service)
    trackMetric('api.request.duration', duration, {
      method: req.method,
      endpoint: req.route?.path || req.path,
      statusCode: res.statusCode,
    });
  });

  next();
};

/**
 * Track metrics (placeholder for actual metrics service)
 */
function trackMetric(name: string, value: number, tags: Record<string, any>) {
  // In production, this would send to Prometheus, DataDog, etc.
  // For now, we'll log it
  logger.debug('Metric tracked', { metric: name, value, tags });
}

/**
 * Request ID middleware
 * Ensures all requests have a unique ID for tracing
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.get('X-Request-ID') || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

/**
 * Rate limit logging
 * Logs when rate limits are hit
 */
export const rateLimitLogger = (req: Request, res: Response, next: NextFunction) => {
  const remaining = res.getHeader('X-RateLimit-Remaining');
  
  if (remaining !== undefined && Number(remaining) < 10) {
    logger.warn('Rate limit approaching', {
      requestId: req.requestId,
      url: req.originalUrl || req.url,
      userId: (req as any).user?.id,
      remaining,
    });
  }

  next();
};

export default {
  requestLogger,
  errorLogger,
  performanceMonitor,
  requestId,
  rateLimitLogger,
};
