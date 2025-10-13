import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string | ((req: Request) => any);
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  totalHits: number;
}

export class RedisRateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  async checkRateLimit(req: Request): Promise<RateLimitResult> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(req) : this.generateKey(req);
    const now = Math.floor(Date.now() / 1000);
    const windowSize = Math.floor(this.config.windowMs / 1000);
    const windowStart = now - windowSize;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Remove old entries outside the current window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      pipeline.zcard(key);

      // Get TTL for key
      pipeline.ttl(key);

      // Execute pipeline
      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const currentRequests = results[1][1] as number;
      const ttl = results[2][1] as number;

      // Check if request exceeds limit
      const allowed = currentRequests < this.config.maxRequests;

      if (allowed) {
        // Add current request to window
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);

        // Set expiry if key doesn't exist
        if (ttl === -1) {
          await this.redis.expire(key, windowSize);
        }
      }

      // Calculate remaining requests and reset time
      const remaining = Math.max(0, this.config.maxRequests - currentRequests - (allowed ? 1 : 0));
      const resetTime = new Date((now + windowSize) * 1000);

      logger.debug('Rate limit check', {
        key: key.replace(/:.*/, ':***'), // Hide sensitive parts in logs
        currentRequests,
        allowed,
        remaining,
        windowSize,
        maxRequests: this.config.maxRequests
      });

      return {
        allowed,
        remaining,
        resetTime,
        totalHits: currentRequests
      };

    } catch (error) {
      logger.error('Redis rate limiter error', {
        error: (error as Error).message,
        key: key.replace(/:.*/, ':***')
      });

      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: new Date(Date.now() + this.config.windowMs),
        totalHits: 0
      };
    }
  }

  private generateKey(req: Request): string {
    const ip = this.getClientIP(req);
    const path = req.path;
    return `rate_limit:${ip}:${path}`;
  }

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await this.checkRateLimit(req);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(result.resetTime.getTime() / 1000).toString(),
          'X-RateLimit-Total': result.totalHits.toString()
        });

        if (!result.allowed) {
          const message = typeof this.config.message === 'function'
            ? this.config.message(req)
            : this.config.message || 'Too many requests';

          logger.warn('Rate limit exceeded', {
            ip: this.getClientIP(req),
            path: req.path,
            userAgent: req.get('User-Agent'),
            totalHits: result.totalHits
          });

          res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message,
            retryAfter: Math.ceil((result.resetTime.getTime() - Date.now()) / 1000),
            resetTime: result.resetTime.toISOString()
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Rate limit middleware error', { error: (error as Error).message });
        // Fail open - allow request if there's an error
        next();
      }
    };
  }

  // Reset rate limit for a specific key
  async resetKey(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.debug('Rate limit key reset', { key: key.replace(/:.*/, ':***') });
    } catch (error) {
      logger.error('Failed to reset rate limit key', {
        error: (error as Error).message,
        key: key.replace(/:.*/, ':***')
      });
    }
  }

  // Get current rate limit status for a key
  async getKeyStatus(key: string): Promise<{
    currentRequests: number;
    remaining: number;
    resetTime: Date | null;
  }> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const windowSize = Math.floor(this.config.windowMs / 1000);
      const windowStart = now - windowSize;

      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);
      pipeline.ttl(key);

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const currentRequests = results[1][1] as number;
      const ttl = results[2][1] as number;
      const remaining = Math.max(0, this.config.maxRequests - currentRequests);

      return {
        currentRequests,
        remaining,
        resetTime: ttl > 0 ? new Date((now + ttl) * 1000) : null
      };
    } catch (error) {
      logger.error('Failed to get rate limit key status', {
        error: (error as Error).message,
        key: key.replace(/:.*/, ':***')
      });

      return {
        currentRequests: 0,
        remaining: this.config.maxRequests,
        resetTime: null
      };
    }
  }
}

// Factory function for creating different rate limiters
export const createRateLimiter = (redis: Redis, config: RateLimitConfig): RedisRateLimiter => {
  return new RedisRateLimiter(redis, config);
};

// Pre-configured rate limiters for common use cases
export const createAuthRateLimiter = (redis: Redis): RedisRateLimiter => {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `auth:${req.ip}:${req.path}`,
    message: {
      success: false,
      error: 'Too many authentication attempts. Please try again later.',
      retryAfter: '15 minutes'
    }
  });
};

export const createApiRateLimiter = (redis: Redis): RedisRateLimiter => {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: (req) => `api:${req.ip}`,
    message: {
      success: false,
      error: 'Too many API requests. Please try again later.',
      retryAfter: '15 minutes'
    }
  });
};

export const createAdminRateLimiter = (redis: Redis): RedisRateLimiter => {
  return createRateLimiter(redis, {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 200,
    keyGenerator: (req) => `admin:${req.user?.id || req.ip}`,
    message: {
      success: false,
      error: 'Too many admin requests. Please try again later.',
      retryAfter: '5 minutes'
    }
  });
};

export const createImportRateLimiter = (redis: Redis): RedisRateLimiter => {
  return createRateLimiter(redis, {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req) => `import:${req.user?.id || req.ip}`,
    message: {
      success: false,
      error: 'Too many import operations. Please try again later.',
      retryAfter: '1 hour'
    }
  });
};