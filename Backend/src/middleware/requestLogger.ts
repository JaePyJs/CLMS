import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Skip logging for health checks and static assets
  const skipPaths = ['/health', '/favicon.ico', '/robots.txt'];
  const shouldSkip = skipPaths.some(path => req.path.startsWith(path)) ||
                    req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/);

  if (shouldSkip) {
    return next();
  }

  // Log incoming request
  const requestLog: any = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString(),
  };

  // Add body for non-GET requests (excluding sensitive data)
  if (req.method !== 'GET' && req.body) {
    const sanitizedBody = sanitizeRequestBody(req.body);
    if (Object.keys(sanitizedBody).length > 0) {
      requestLog.body = sanitizedBody;
    }
  }

  logger.info('Incoming Request', requestLog);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): Response {
    const responseTime = Date.now() - req.startTime;
    
    // Log response
    const responseLog = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
      contentType: res.get('Content-Type'),
      timestamp: new Date().toISOString(),
    };

    // Determine log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Response Error', responseLog);
    } else if (res.statusCode >= 400) {
      logger.warn('Response Warning', responseLog);
    } else {
      logger.info('Response Success', responseLog);
    }

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow Request', {
        ...responseLog,
        performance: 'slow',
        threshold: '1000ms',
      });
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Sanitize request body to remove sensitive information
const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'authorization',
    'cookie',
    'session',
    'csrf',
    'ssn',
    'social_security',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
  ];

  const sanitized = { ...body };

  const sanitizeObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }

    return obj;
  };

  return sanitizeObject(sanitized);
};

// Performance monitoring middleware
export const performanceLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    const performanceLog = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    // Log performance metrics
    if (duration > 5000) { // 5 seconds
      logger.error('Very Slow Request', performanceLog);
    } else if (duration > 2000) { // 2 seconds
      logger.warn('Slow Request', performanceLog);
    } else if (duration > 1000) { // 1 second
      logger.info('Moderate Request', performanceLog);
    }
  });

  next();
};

// Request correlation middleware for distributed tracing
export const correlationLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Check for existing correlation ID from upstream services
  const correlationId = req.get('X-Correlation-ID') || 
                       req.get('X-Request-ID') || 
                       req.requestId || 
                       uuidv4();

  // Set correlation ID
  req.requestId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  // Add to logger context
  logger.defaultMeta = {
    ...logger.defaultMeta,
    correlationId,
  };

  next();
};

// Security logging middleware
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const securityLog = {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  };

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
    /eval\(/i,  // Code injection
  ];

  const urlAndQuery = req.originalUrl + JSON.stringify(req.body || {});
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(urlAndQuery));

  if (isSuspicious) {
    logger.warn('Suspicious Request Detected', {
      ...securityLog,
      severity: 'medium',
      reason: 'Pattern match',
    });
  }

  // Log failed authentication attempts
  res.on('finish', () => {
    if (res.statusCode === 401 && req.path.includes('/auth')) {
      logger.warn('Failed Authentication Attempt', {
        ...securityLog,
        statusCode: res.statusCode,
        severity: 'high',
      });
    }
  });

  next();
};

export default requestLogger;