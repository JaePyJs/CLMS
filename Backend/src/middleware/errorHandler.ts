import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CLMSError, ErrorFactory, getErrorResponse } from '@/errors/error-types';
import { logger } from '@/utils/logger';

// Request interface extension
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: any;
    }
  }
}

// Error handler middleware
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID if not present
  const requestId = req.requestId || uuidv4();
  req.requestId = requestId;

  // Create CLMS error
  const clmsError = ErrorFactory.createError(error, {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  });

  // Log the error
  clmsError.logError();

  // Send error response
  const errorResponse = getErrorResponse(clmsError, requestId);

  // Add security headers
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  res.status(clmsError.statusCode).json(errorResponse);
}

// Async error wrapper
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new CLMSError(`Route ${req.method} ${req.path} not found`) as any;
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  error.isOperational = true;
  next(error);
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  req.requestId = requestId;

  const startTime = Date.now();

  // Log request
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

// Validation middleware using Zod schemas
export function validateRequest(schema: {
  body?: any;
  query?: any;
  params?: any;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate body
      if (schema.body) {
        const result = schema.body.safeParse(req.body);
        if (!result.success) {
          throw new ValidationError(
            'Request body validation failed',
            result.error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
            { requestId: req.requestId }
          );
        }
        req.body = result.data;
      }

      // Validate query
      if (schema.query) {
        const result = schema.query.safeParse(req.query);
        if (!result.success) {
          throw new ValidationError(
            'Query parameters validation failed',
            result.error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
            { requestId: req.requestId }
          );
        }
        req.query = result.data;
      }

      // Validate params
      if (schema.params) {
        const result = schema.params.safeParse(req.params);
        if (!result.success) {
          throw new ValidationError(
            'URL parameters validation failed',
            result.error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
            { requestId: req.requestId }
          );
        }
        req.params = result.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Rate limiting middleware
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Clean up old entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < now) {
        requests.delete(k);
      }
    }

    // Get or create request count
    let requestData = requests.get(key);
    if (!requestData || requestData.resetTime < now) {
      requestData = { count: 0, resetTime: now + options.windowMs };
      requests.set(key, requestData);
    }

    requestData.count++;

    // Check if limit exceeded
    if (requestData.count > options.max) {
      const error = new RateLimitError(
        options.message || 'Too many requests',
        Math.ceil((requestData.resetTime - now) / 1000),
        { requestId: req.requestId, ip: req.ip }
      );
      return next(error);
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - requestData.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(requestData.resetTime / 1000));

    next();
  };
}