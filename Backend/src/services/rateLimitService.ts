import Redis from 'ioredis';
import { logger } from '@/utils/logger';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  onLimitReached?: (req: any, res: any) => void;
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

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.defaultConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      message: 'Too many requests from this IP, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
  }

  /**
   * Create rate limiting middleware
   */
  createRateLimit(config: Partial<RateLimitConfig> = {}) {
    const finalConfig: RateLimitConfig = { ...this.defaultConfig, ...config };

    return async (req: any, res: any, next: any): Promise<void> => {
      try {
        // Generate key for rate limiting
        const key = this.generateKey(req, finalConfig);
        const now = Date.now();
        const windowStart = now - finalConfig.windowMs;

        // Use Redis pipeline for atomic operations
        const pipeline = this.redis.pipeline();

        // Remove old entries outside the window
        pipeline.zremrangebyscore(key, 0, windowStart);

        // Count current requests in window
        pipeline.zcard(key);

        // Add current request
        pipeline.zadd(key, now, `${now}-${Math.random()}`);

        // Set expiration on the key
        pipeline.expire(key, Math.ceil(finalConfig.windowMs / 1000));

        const results = await pipeline.exec();

        if (!results) {
          throw new Error('Redis pipeline failed');
        }

        const [, currentCount] = results[1] as [any, number] | undefined;
        const requestCount = currentCount || 0;

        // Calculate remaining requests and reset time
        const remaining = Math.max(0, finalConfig.max - requestCount);
        const resetTime = new Date(now + finalConfig.windowMs);

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': finalConfig.max,
          'X-RateLimit-Remaining': remaining,
          'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000),
        });

        // Check if rate limit exceeded
        if (requestCount > finalConfig.max) {
          logger.warn('Rate limit exceeded', {
            key,
            count: requestCount,
            max: finalConfig.max,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });

          // Call custom handler if provided
          if (finalConfig.onLimitReached) {
            finalConfig.onLimitReached(req, res);
          }

          // Return rate limit error
          res.status(429).json({
            error: finalConfig.message,
            retryAfter: Math.ceil(finalConfig.windowMs / 1000),
            resetTime: resetTime.toISOString(),
          });
          return;
        }

        // Track successful/failed requests if configured
        this.trackRequest(req, res, finalConfig, key, now);

        // Continue to next middleware
        next();
      } catch (error) {
        logger.error('Rate limiting error', {
          error: (error as Error).message,
          ip: req.ip,
        });

        // Fail open - allow request if rate limiting fails
        next();
      }
    };
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
   * Helper methods
   */
  private generateKey(req: any, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return `rate_limit:${config.keyGenerator(req)}`;
    }

    // Default key generation based on IP
    return `rate_limit:${req.ip}`;
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

// Export types
export type { RateLimitConfig, RateLimitResult };