import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
  headers?: boolean;
}

// Role-based rate limit configuration
interface RoleBasedRateLimit {
  [role: string]: RateLimitConfig;
}

// Rate limiting algorithms
enum RateLimitAlgorithm {
  TOKEN_BUCKET = 'token_bucket',
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  EXPONENTIAL_BACKOFF = 'exponential_backoff'
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  totalHits: number;
}

class RateLimitService {
  private redis: Redis;
  private defaultConfig: RateLimitConfig;
  private roleBasedLimits: RoleBasedRateLimit;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetries: 3,
      lazyConnect: true,
    });

    this.setupRoleBasedLimits();
    this.defaultConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      message: 'Too many requests from this IP, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      headers: true,
    };
  }

  private setupRoleBasedLimits(): void {
    this.roleBasedLimits = {
      // Super admins have very liberal limits
      SUPER_ADMIN: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5000,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        headers: true
      },
      // Admins have high limits
      ADMIN: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 2000,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        headers: true
      },
      // Librarians have moderate limits
      LIBRARIAN: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        headers: true
      },
      // Teachers have lower limits
      TEACHER: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 500,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        headers: true
      },
      // Students have the lowest limits
      STUDENT: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        headers: true
      },
      // Viewers have very limited access
      VIEWER: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        headers: true
      },
      // Unauthenticated users have very strict limits
      UNAUTHENTICATED: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        headers: true
      }
    };
  }

  // Get user role from request
  private getUserRole(req: Request): string {
    const user = (req as any).user;
    return user?.role || 'UNAUTHENTICATED';
  }

  // Generate rate limit key
  private generateKey(req: Request, algorithm: RateLimitAlgorithm): string {
    const user = (req as any).user;
    const role = this.getUserRole(req);
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const endpoint = req.path;

    switch (algorithm) {
      case RateLimitAlgorithm.TOKEN_BUCKET:
        return `token_bucket:${role}:${user?.id || ip}`;
      case RateLimitAlgorithm.FIXED_WINDOW:
        return `fixed_window:${role}:${user?.id || ip}:${endpoint}`;
      case RateLimitAlgorithm.SLIDING_WINDOW:
        return `sliding_window:${role}:${user?.id || ip}:${endpoint}`;
      case RateLimitAlgorithm.EXPONENTIAL_BACKOFF:
        return `exp_backoff:${role}:${user?.id || ip}:${endpoint}`;
      default:
        return `rate_limit:${role}:${user?.id || ip}`;
    }
  }

  /**
   * Create rate limiting middleware (legacy support)
   */
  createRateLimit(config: Partial<RateLimitConfig> = {}) {
    return this.createRoleBasedRateLimit(RateLimitAlgorithm.SLIDING_WINDOW, config);
  }

  /**
   * Create advanced rate limiting with multiple tiers
   */
  createTieredRateLimit(tiers: Array<{
    max: number;
    windowMs: number;
    priority?: number;
    conditions?: (req: any) => boolean;
  }>) {
    return async (req: any, res: any, next: any): Promise<void> => {
      try {
        // Find applicable tier
        const tier = tiers.find(t => !t.conditions || t.conditions(req));

        if (!tier) {
          // No matching tier, use default
          return this.createRateLimit()(req, res, next);
        }

        // Create rate limit for this tier
        const tieredConfig: RateLimitConfig = {
          windowMs: tier.windowMs,
          max: tier.max,
          message: `Rate limit exceeded (${tier.max} requests per ${tier.windowMs / 1000}s)`,
        };

        return this.createRateLimit(tieredConfig)(req, res, next);
      } catch (error) {
        logger.error('Tiered rate limiting error', {
          error: (error as Error).message,
        });
        next();
      }
    };
  }

  /**
   * Create user-based rate limiting
   */
  createUserRateLimit(config: Partial<RateLimitConfig> = {}) {
    const userConfig: RateLimitConfig = {
      ...this.defaultConfig,
      ...config,
      keyGenerator: (req: any) => {
        // Use user ID if authenticated, otherwise IP
        const user = req.user;
        return user ? `user:${user.id}` : `ip:${req.ip}`;
      },
    };

    return this.createRateLimit(userConfig);
  }

  /**
   * Create endpoint-specific rate limiting
   */
  createEndpointRateLimit(
    endpointConfig: Record<string, Partial<RateLimitConfig>>,
    defaultConfig: Partial<RateLimitConfig> = {}
  ) {
    return (req: any, res: any, next: any): void => {
      const route = req.route?.path || req.path;
      const method = req.method;
      const key = `${method}:${route}`;

      const config = endpointConfig[key] || defaultConfig;

      if (config) {
        const middleware = this.createRateLimit({
          ...config,
          keyGenerator: () => `${key}:${req.ip}`,
        });

        return middleware(req, res, next);
      }

      next();
    };
  }

  /**
   * Get rate limit status for a specific key
   */
  async getRateLimitStatus(key: string, windowMs: number): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Count requests in window
      const requestCount = await this.redis.zcount(key, windowStart, now);

      // Get TTL for reset time
      const ttl = await this.redis.ttl(key);
      const resetTime = new Date(now + (ttl * 1000));

      return {
        allowed: true,
        remaining: Math.max(0, this.defaultConfig.max - requestCount),
        resetTime,
        totalHits: requestCount,
      };
    } catch (error) {
      logger.error('Failed to get rate limit status', {
        error: (error as Error).message,
        key,
      });

      return {
        allowed: true,
        remaining: this.defaultConfig.max,
        resetTime: new Date(Date.now() + windowMs),
        totalHits: 0,
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        error: (error as Error).message,
        key,
      });
      return false;
    }
  }

  /**
   * Get rate limit statistics
   */
  async getRateLimitStats(): Promise<{
    totalKeys: number;
    activeLimits: number;
    topViolators: Array<{ key: string; count: number }>;
    distribution: Record<string, number>;
  }> {
    try {
      // Get all rate limit keys
      const keys = await this.redis.keys('rate_limit:*');

      let totalRequests = 0;
      const violators: Array<{ key: string; count: number }> = [];
      const distribution: Record<string, number> = {};

      for (const key of keys.slice(0, 100)) { // Limit to prevent too many operations
        try {
          const count = await this.redis.zcard(key);
          totalRequests += count;

          if (count > 100) { // Consider as potential violator
            violators.push({ key, count });
          }

          // Distribution analysis
          const range = this.getRequestRange(count);
          distribution[range] = (distribution[range] || 0) + 1;
        } catch (error) {
          // Skip failed keys
        }
      }

      return {
        totalKeys: keys.length,
        activeLimits: keys.length,
        topViolators: violators.sort((a, b) => b.count - a.count).slice(0, 10),
        distribution,
      };
    } catch (error) {
      logger.error('Failed to get rate limit stats', {
        error: (error as Error).message,
      });

      return {
        totalKeys: 0,
        activeLimits: 0,
        topViolators: [],
        distribution: {},
      };
    }
  }

  /**
   * Create adaptive rate limiting based on system load
   */
  createAdaptiveRateLimit(config: Partial<RateLimitConfig> = {}) {
    return async (req: any, res: any, next: any): Promise<void> => {
      try {
        // Get current system metrics
        const memoryUsage = process.memoryUsage();
        const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

        // Adjust rate limits based on system load
        let adjustedMax = config.max || this.defaultConfig.max;
        let adjustedWindow = config.windowMs || this.defaultConfig.windowMs;

        if (memoryPercent > 80) {
          // High memory usage - reduce rate limits
          adjustedMax = Math.floor(adjustedMax * 0.5);
          adjustedWindow = Math.floor(adjustedWindow * 1.5);
        } else if (memoryPercent > 60) {
          // Medium memory usage - slightly reduce rate limits
          adjustedMax = Math.floor(adjustedMax * 0.8);
        }

        const adaptiveConfig: RateLimitConfig = {
          ...this.defaultConfig,
          ...config,
          max: adjustedMax,
          windowMs: adjustedWindow,
        };

        logger.debug('Adaptive rate limiting applied', {
          memoryPercent: Math.round(memoryPercent),
          originalMax: config.max || this.defaultConfig.max,
          adjustedMax,
          originalWindow: config.windowMs || this.defaultConfig.windowMs,
          adjustedWindow,
        });

        return this.createRateLimit(adaptiveConfig)(req, res, next);
      } catch (error) {
        logger.error('Adaptive rate limiting error', {
          error: (error as Error).message,
        });
        next();
      }
    };
  }

  /**
   * Main rate limiting method with role-based support and multiple algorithms
   */
  public async checkRateLimit(
    req: Request,
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.TOKEN_BUCKET
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number; config: RateLimitConfig }> {
    const role = this.getUserRole(req);
    const config = this.roleBasedLimits[role] || this.defaultConfig;

    let result: { allowed: boolean; remaining: number; resetTime: number };

    switch (algorithm) {
      case RateLimitAlgorithm.TOKEN_BUCKET:
        result = await this.tokenBucket(req, config);
        break;
      case RateLimitAlgorithm.FIXED_WINDOW:
        result = await this.fixedWindow(req, config);
        break;
      case RateLimitAlgorithm.SLIDING_WINDOW:
        result = await this.slidingWindow(req, config);
        break;
      case RateLimitAlgorithm.EXPONENTIAL_BACKOFF:
        result = await this.exponentialBackoff(req, config);
        break;
      default:
        result = await this.tokenBucket(req, config);
    }

    // Log rate limit events
    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        role,
        algorithm,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: (req as any).requestId,
        endpoint: req.path,
        method: req.method
      });
    }

    return {
      ...result,
      config
    };
  }

  /**
   * Token bucket algorithm implementation
   */
  private async tokenBucket(
    req: Request,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.generateKey(req, RateLimitAlgorithm.TOKEN_BUCKET);
    const now = Date.now();
    const windowSize = config.windowMs;
    const maxTokens = config.max;
    const refillRate = maxTokens / (windowSize / 1000); // tokens per second

    try {
      // Get current bucket state from Redis
      const bucketData = await this.redis.hgetall(`bucket:${key}`);

      let tokens = parseFloat(bucketData.tokens || maxTokens.toString());
      let lastRefill = parseInt(bucketData.lastRefill || now.toString());

      // Refill tokens based on time passed
      const timePassed = (now - lastRefill) / 1000;
      tokens = Math.min(maxTokens, tokens + (timePassed * refillRate));

      // Check if request can be processed
      if (tokens >= 1) {
        tokens -= 1;

        // Update bucket state
        await this.redis.hset(`bucket:${key}`, {
          tokens: tokens.toString(),
          lastRefill: now.toString()
        });

        await this.redis.expire(`bucket:${key}`, Math.ceil(windowSize / 1000));

        return {
          allowed: true,
          remaining: Math.floor(tokens),
          resetTime: now + windowSize
        };
      } else {
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + windowSize
        };
      }
    } catch (error) {
      logger.error('Token bucket algorithm error', { error, key });
      // Fallback to sliding window
      return this.slidingWindow(req, config);
    }
  }

  /**
   * Fixed window algorithm implementation
   */
  private async fixedWindow(
    req: Request,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.generateKey(req, RateLimitAlgorithm.FIXED_WINDOW);
    const now = Date.now();
    const windowSize = config.windowMs;
    const windowStart = Math.floor(now / windowSize) * windowSize;
    const windowEnd = windowStart + windowSize;

    try {
      const currentCount = await this.redis.incr(`fixed:${key}:${windowStart}`);

      if (currentCount === 1) {
        await this.redis.expire(`fixed:${key}:${windowStart}`, Math.ceil(windowSize / 1000));
      }

      return {
        allowed: currentCount <= config.max,
        remaining: Math.max(0, config.max - currentCount),
        resetTime: windowEnd
      };
    } catch (error) {
      logger.error('Fixed window algorithm error', { error, key });
      // Fallback to sliding window
      return this.slidingWindow(req, config);
    }
  }

  /**
   * Exponential backoff algorithm implementation
   */
  private async exponentialBackoff(
    req: Request,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.generateKey(req, RateLimitAlgorithm.EXPONENTIAL_BACKOFF);
    const now = Date.now();

    try {
      const backoffData = await this.redis.hgetall(`backoff:${key}`);

      let attemptCount = parseInt(backoffData.attempts || '0');
      let lastAttempt = parseInt(backoffData.lastAttempt || '0');
      let blockedUntil = parseInt(backoffData.blockedUntil || '0');

      // Check if currently blocked
      if (now < blockedUntil) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: blockedUntil
        };
      }

      // Calculate backoff delay
      const backoffDelay = Math.min(
        config.windowMs,
        Math.pow(2, attemptCount) * 1000 // Exponential backoff
      );

      // Check if enough time has passed since last attempt
      if (now - lastAttempt < backoffDelay) {
        // Block until backoff period expires
        const newBlockedUntil = now + backoffDelay;

        await this.redis.hset(`backoff:${key}`, {
          blockedUntil: newBlockedUntil.toString()
        });

        await this.redis.expire(`backoff:${key}`, Math.ceil(backoffDelay / 1000) + 1);

        return {
          allowed: false,
          remaining: 0,
          resetTime: newBlockedUntil
        };
      }

      // Allow request and update counters
      attemptCount++;

      await this.redis.hset(`backoff:${key}`, {
        attempts: attemptCount.toString(),
        lastAttempt: now.toString()
      });

      await this.redis.expire(`backoff:${key}`, Math.ceil(config.windowMs / 1000) + 1);

      return {
        allowed: true,
        remaining: Math.max(0, config.max - attemptCount),
        resetTime: now + config.windowMs
      };
    } catch (error) {
      logger.error('Exponential backoff algorithm error', { error, key });
      // Fallback to sliding window
      return this.slidingWindow(req, config);
    }
  }

  /**
   * Middleware factory with role-based support
   */
  public createRoleBasedRateLimit(
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.TOKEN_BUCKET,
    customConfig?: Partial<RateLimitConfig>
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const role = this.getUserRole(req);
        const baseConfig = this.roleBasedLimits[role] || this.defaultConfig;
        const config = { ...baseConfig, ...customConfig };

        const result = await this.checkRateLimit(req, algorithm);

        // Set rate limit headers
        if (config.headers) {
          res.setHeader('X-RateLimit-Limit', config.max.toString());
          res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
          res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
          res.setHeader('X-RateLimit-Algorithm', algorithm);
          res.setHeader('X-RateLimit-Role', role);
        }

        if (!result.allowed) {
          const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
          res.setHeader('Retry-After', retryAfter.toString());

          // Call custom limit reached handler if provided
          if (config.onLimitReached) {
            config.onLimitReached(req, res);
          }

          logger.warn('Rate limit exceeded - request blocked', {
            ip: req.ip,
            role,
            algorithm,
            endpoint: req.path,
            method: req.method,
            retryAfter,
            requestId: (req as any).requestId
          });

          res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter,
            timestamp: new Date().toISOString(),
            rateLimitInfo: {
              limit: config.max,
              remaining: result.remaining,
              resetTime: result.resetTime,
              algorithm,
              role
            }
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Rate limiting middleware error', { error, requestId: (req as any).requestId });

        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  /**
   * Progressive rate limiting for abusive behavior
   */
  public async progressiveRateLimit(
    req: Request,
    violations: number
  ): Promise<{ allowed: boolean; penaltyMinutes: number }> {
    const role = this.getUserRole(req);
    const baseConfig = this.roleBasedLimits[role] || this.defaultConfig;

    // Calculate progressive penalty
    const penaltyMinutes = Math.min(
      60 * 24, // Max 24 hours
      Math.pow(2, violations - 1) * 5 // Start at 5 minutes
    );

    const penaltyMs = penaltyMinutes * 60 * 1000;
    const key = `progressive:${this.getUserRole(req)}:${req.ip}`;

    try {
      const blockedUntil = await this.redis.get(key);
      const now = Date.now();

      if (blockedUntil && parseInt(blockedUntil) > now) {
        return {
          allowed: false,
          penaltyMinutes: Math.ceil((parseInt(blockedUntil) - now) / 60000)
        };
      }

      // Set progressive block
      await this.redis.setex(key, Math.ceil(penaltyMs / 1000), (now + penaltyMs).toString());

      logger.warn('Progressive rate limit applied', {
        key,
        role,
        violations,
        penaltyMinutes,
        ip: req.ip,
        endpoint: req.path,
        requestId: (req as any).requestId
      });

      return {
        allowed: false,
        penaltyMinutes
      };
    } catch (error) {
      logger.error('Progressive rate limiting error', { error, key });
      return { allowed: true, penaltyMinutes: 0 };
    }
  }

  /**
   * Cleanup old rate limit data
   */
  async cleanup(): Promise<number> {
    try {
      const keys = await this.redis.keys('rate_limit:*');
      let deleted = 0;

      for (const key of keys) {
        try {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) { // No expiration set
            await this.redis.expire(key, 3600); // Set 1 hour expiration
            deleted++;
          }
        } catch (error) {
          // Skip failed keys
        }
      }

      logger.info('Rate limit cleanup completed', { deleted });
      return deleted;
    } catch (error) {
      logger.error('Rate limit cleanup failed', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  /**
   * Sliding window algorithm implementation
   */
  private async slidingWindow(
    req: Request,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.generateKey(req, RateLimitAlgorithm.SLIDING_WINDOW);
    const now = Date.now();
    const windowSize = config.windowMs;

    try {
      const pipeline = this.redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(`sliding:${key}`, 0, now - windowSize);

      // Add current request
      pipeline.zadd(`sliding:${key}`, now, `${now}-${Math.random()}`);

      // Count requests in window
      pipeline.zcard(`sliding:${key}`);

      // Set expiry
      pipeline.expire(`sliding:${key}`, Math.ceil(windowSize / 1000) + 1);

      const results = await pipeline.exec();
      const currentCount = results?.[2]?.[1] as number || 0;

      return {
        allowed: currentCount <= config.max,
        remaining: Math.max(0, config.max - currentCount),
        resetTime: now + windowSize
      };
    } catch (error) {
      logger.error('Sliding window algorithm error', { error, key });
      // Fallback - allow request
      return {
        allowed: true,
        remaining: config.max - 1,
        resetTime: now + windowSize
      };
    }
  }

  private async trackRequest(
    req: any,
    res: any,
    config: RateLimitConfig,
    key: string,
    timestamp: number
  ): Promise<void> {
    try {
      const isSuccess = res.statusCode < 400;
      const isFailure = res.statusCode >= 400;

      // Skip tracking based on configuration
      if (config.skipSuccessfulRequests && isSuccess) return;
      if (config.skipFailedRequests && isFailure) return;

      // Store request metadata for analytics
      const metadata = {
        timestamp,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      };

      // Store in a separate sorted set for analytics
      await this.redis.zadd(`${key}:meta`, timestamp, JSON.stringify(metadata));
      await this.redis.expire(`${key}:meta`, Math.ceil(config.windowMs / 1000));
    } catch (error) {
      // Don't let tracking errors affect the main flow
      logger.debug('Request tracking failed', {
        error: (error as Error).message,
      });
    }
  }

  private getRequestRange(count: number): string {
    if (count < 10) return '1-9';
    if (count < 50) return '10-49';
    if (count < 100) return '50-99';
    if (count < 500) return '100-499';
    if (count < 1000) return '500-999';
    return '1000+';
  }
}

// Create singleton instance
export const rateLimitService = new RateLimitService();

// Export class for testing
export { RateLimitService };

// Export types and enums
export type { RateLimitConfig, RateLimitResult, RoleBasedRateLimit };
export { RateLimitAlgorithm };