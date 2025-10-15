import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '@/utils/logger';
import { ValidationError } from '@/errors/error-types';
import { rateLimitService, RateLimitAlgorithm } from '@/services/rateLimitService';

// Security configuration interface
interface SecurityConfig {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: string[];
      styleSrc: string[];
      scriptSrc: string[];
      imgSrc: string[];
      connectSrc: string[];
      fontSrc: string[];
      objectSrc: string[];
      mediaSrc: string[];
      frameSrc: string[];
      childSrc: string[];
      workerSrc: string[];
      manifestSrc: string[];
      upgradeInsecureRequests: boolean;
    };
    reportOnly?: boolean;
  };
  rateLimiting: {
    windowMs: number;
    max: number;
    message: string;
    skipSuccessfulRequests: boolean;
    keyGenerator?: (req: Request) => string;
  };
  cors: {
    origin: string[] | string;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  securityHeaders: {
    hidePoweredBy: boolean;
    noSniff: boolean;
    frameguard: boolean;
    xssFilter: boolean;
    ieNoOpen: boolean;
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-eval'", // Only for development
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "https://res.cloudinary.com",
        "https://covers.openlibrary.org"
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://www.google-analytics.com",
        "ws:",
        "wss:"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://fonts.googleapis.com"
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: true
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: {
      success: false,
      error: 'Too many requests, please try again later.',
      timestamp: new Date().toISOString(),
      retryAfter: 15 * 60 // 15 minutes in seconds
    },
    skipSuccessfulRequests: false,
    keyGenerator: (req: Request) => {
      // Use user ID if available, otherwise IP
      const user = (req as any).user;
      return user?.id || req.ip || req.connection.remoteAddress || 'unknown';
    }
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    credentials: true,
    maxAge: 86400 // 24 hours
  },
  securityHeaders: {
    hidePoweredBy: true,
    noSniff: true,
    frameguard: true,
    xssFilter: true,
    ieNoOpen: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  }
};

// Request tracking
const requestTracker = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware factory
export const createRateLimit = (config: SecurityConfig['rateLimiting']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = config.keyGenerator ? config.keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries
    for (const [k, v] of requestTracker.entries()) {
      if (v.resetTime < now) {
        requestTracker.delete(k);
      }
    }

    // Get or create request count
    let requestData = requestTracker.get(key);
    if (!requestData || requestData.resetTime < now) {
      requestData = { count: 0, resetTime: now + config.windowMs };
      requestTracker.set(key, requestData);
    }

    requestData.count++;

    // Check if limit exceeded
    if (requestData.count > config.max) {
      const retryAfter = Math.ceil((requestData.resetTime - now) / 1000);

      logger.warn('Rate limit exceeded', {
        key,
        count: requestData.count,
        max: config.max,
        retryAfter,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });

      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', config.max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', Math.ceil(requestData.resetTime / 1000).toString());

      return res.status(429).json({
        ...(typeof config.message === 'string'
          ? { error: config.message }
          : config.message
        ),
        retryAfter
      });
    }

    // Set rate limit headers
    const remaining = Math.max(0, config.max - requestData.count);
    res.setHeader('X-RateLimit-Limit', config.max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(requestData.resetTime / 1000).toString());

    next();
  };
};

// Input validation middleware
export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  // Check for common attack patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /expression\s*\(/gi,
    /@import/i,
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+set/i
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  // Check URL parameters
  const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
  for (const [key, value] of urlParams) {
    if (checkValue(value)) {
      logger.warn('Suspicious input detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId,
        parameter: key,
        value: value.substring(0, 100) // Log first 100 chars
      });

      throw new ValidationError('Invalid input detected');
    }
  }

  // Check request body
  if (req.body && checkValue(req.body)) {
    logger.warn('Suspicious input detected in body', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });

    throw new ValidationError('Invalid input detected');
  }

  next();
};

// Security headers middleware
export const securityHeaders = (config: SecurityConfig['securityHeaders'] = defaultSecurityConfig.securityHeaders) => {
  return helmet({
    hidePoweredBy: config.hidePoweredBy,
    contentSecurityPolicy: false, // We'll handle CSP separately
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: config.frameguard,
    permittedCrossDomainPolicies: false,
    hsts: config.hsts,
    ieNoOpen: config.ieNoOpen,
    noSniff: config.noSniff,
    originAgentCluster: false,
    referrerPolicy: false,
    xssFilter: config.xssFilter
  });
};

// Content Security Policy middleware
export const contentSecurityPolicy = (config: SecurityConfig['contentSecurityPolicy'] = defaultSecurityConfig.contentSecurityPolicy) => {
  const cspValue = Object.entries(config.directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');

  return (req: Request, res: Response, next: NextFunction) => {
      if (config.reportOnly) {
        res.setHeader('Content-Security-Policy-Report-Only', cspValue);
      } else {
        res.setHeader('Content-Security-Policy', cspValue);
      }
      next();
    };
};

// IP filtering middleware
export const ipFilter = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedIPs.length === 0) {
      return next(); // No IP filtering if no allowed IPs specified
    }

    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    if (!allowedIPs.includes(clientIP)) {
      logger.warn('Unauthorized IP access attempt', {
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId,
        url: req.url
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied from this IP address',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// User agent filtering middleware
export const userAgentFilter = (blockedUserAgents: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.get('User-Agent') || '';

    const isBlocked = blockedUserAgents.some(blocked =>
      userAgent.toLowerCase().includes(blocked.toLowerCase())
    );

    if (isBlocked) {
      logger.warn('Blocked user agent access attempt', {
        userAgent,
        ip: req.ip,
        requestId: req.requestId,
        url: req.url
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// Request size limiting middleware
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length');

    if (contentLength && parseInt(contentLength) > maxSize) {
      logger.warn('Request size limit exceeded', {
        contentLength,
        maxSize,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId,
        url: req.url
      });

      return res.status(413).json({
        success: false,
        error: 'Request entity too large',
        maxSize: `${maxSize / 1024 / 1024}MB`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// Timeout middleware
export const requestTimeout = (timeout: number = 30000) => { // 30 seconds default
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          timeout,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: req.requestId,
          url: req.url,
          method: req.method
        });

        res.status(408).json({
          success: false,
          error: 'Request timeout',
          timeout: `${timeout / 1000} seconds`,
          timestamp: new Date().toISOString()
        });
      }
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Security audit middleware
export const securityAudit = (req: Request, res: Response, next: NextFunction) => {
  const auditData = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    headers: {
      'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
      'cookie': req.get('Cookie') ? '[REDACTED]' : undefined,
      'x-api-key': req.get('X-API-Key') ? '[REDACTED]' : undefined
    },
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    origin: req.get('Origin')
  };

  // Log security-relevant requests
  if (req.path.includes('/api/') || req.path.includes('/admin/')) {
    logger.info('Security audit', auditData);
  }

  next();
};

// Enhanced comprehensive security middleware with role-based rate limiting
export const comprehensiveSecurity = (config: Partial<SecurityConfig> = {}) => {
  const securityConfig = {
    ...defaultSecurityConfig,
    ...config
  };

  return [
    securityAudit,
    requestSizeLimit(),
    requestTimeout(),
    validateInput,
    // Use enhanced role-based rate limiting with token bucket algorithm
    rateLimitService.createRoleBasedRateLimit(RateLimitAlgorithm.TOKEN_BUCKET, {
      windowMs: securityConfig.rateLimiting.windowMs,
      max: securityConfig.rateLimiting.max,
      message: typeof securityConfig.rateLimiting.message === 'string'
        ? securityConfig.rateLimiting.message
        : 'Too many requests, please try again later.',
      skipSuccessfulRequests: securityConfig.rateLimiting.skipSuccessfulRequests,
      headers: true
    }),
    securityHeaders(securityConfig.securityHeaders),
    contentSecurityPolicy(securityConfig.contentSecurityPolicy),
    ipFilter(),
    userAgentFilter()
  ];
};

// Create specialized rate limiting middleware for different endpoints
export const createAPIRateLimit = (algorithm: RateLimitAlgorithm = RateLimitAlgorithm.SLIDING_WINDOW) => {
  return rateLimitService.createRoleBasedRateLimit(algorithm);
};

export const createAuthRateLimit = () => {
  return rateLimitService.createRoleBasedRateLimit(RateLimitAlgorithm.EXPONENTIAL_BACKOFF, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Stricter limit for auth endpoints
    message: 'Too many authentication attempts, please try again later.'
  });
};

export const createAdminRateLimit = () => {
  return rateLimitService.createRoleBasedRateLimit(RateLimitAlgorithm.TOKEN_BUCKET, {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Liberal limit for admin users
    message: 'Admin rate limit exceeded, please try again later.'
  });
};

export default comprehensiveSecurity;