import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { performance } from 'perf_hooks';
import Redis from 'ioredis';
import { optimizedDatabase } from '@/config/database';

interface PerformanceMetrics {
  route: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  cacheHit?: boolean;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

class PerformanceMiddleware {
  private redis: Redis;
  private metrics: PerformanceMetrics[] = [];
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  /**
   * Request performance monitoring middleware
   */
  requestTimer() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      // Store original res.end to capture response timing
      const originalEnd = res.end.bind(res);
      const newEnd: typeof res.end = function(this: Response, chunk?: any, encoding?: any, cb?: any) {
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;

        const userAgent = req.get('User-Agent') || '';
        const ip = typeof req.ip === 'string' ? req.ip : '';
        const cacheHit = !!(res.locals as any).cacheHit;

        // Record performance metrics
        const metrics: PerformanceMetrics = {
          route: req.route?.path || req.path,
          method: req.method,
          duration: Math.round(duration),
          statusCode: res.statusCode,
          timestamp: new Date(),
          userAgent,
          ip,
          cacheHit,
        };

        // Log slow requests
        if (duration > 1000) {
          logger.warn('Slow request detected', {
            route: metrics.route,
            method: metrics.method,
            duration: `${duration}ms`,
            statusCode: metrics.statusCode,
            ip: metrics.ip,
          });
        }

        // Log very slow requests as errors
        if (duration > 5000) {
          logger.error('Very slow request detected', {
            route: metrics.route,
            method: metrics.method,
            duration: `${duration}ms`,
            statusCode: metrics.statusCode,
            recommendation: 'This endpoint needs optimization',
          });
        }

        // Store metrics for analysis
        performanceMiddleware.addMetrics(metrics);

        // Add performance headers
        res.set({
          'X-Response-Time': `${Math.round(duration)}ms`,
          'X-Memory-Usage': `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
          'X-Cache-Status': metrics.cacheHit ? 'HIT' : 'MISS',
        });

        // Log in development mode
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${Math.round(duration)}ms`,
            memory: `${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024)}KB`,
          });
        }

        return (originalEnd as any).call(this, chunk, encoding, cb);
      } as any;
      res.end = newEnd;

      next();
    };
  }

  /**
   * ETag caching middleware for conditional requests
   */
  etagCache() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = `etag:${req.method}:${req.originalUrl}`;
      const clientETag = req.get('If-None-Match');

      try {
        // Check if we have a cached ETag
        const cachedETag = await this.redis.get(cacheKey);
        const cachedResponse = await this.redis.get(`${cacheKey}:response`);

        if (cachedETag && cachedResponse) {
          // If client has the same ETag, return 304 Not Modified
          if (clientETag === cachedETag) {
            res.status(304).end();
            res.locals.cacheHit = true;
            return;
          }

          // Otherwise return cached response with ETag
          const response = JSON.parse(cachedResponse);
          res.set('ETag', cachedETag);
          res.set('X-Cache', 'HIT');
          res.json(response.data);
          res.locals.cacheHit = true;
          return;
        }

        // Continue to next middleware
        next();

        // Cache the response if it's successful
        if (res.statusCode === 200) {
          const originalJson = res.json.bind(res);
          const redis = this.redis;
          res.json = (data: any): Response => {
            const content = JSON.stringify(data);
            const etag = `"${require('crypto').createHash('md5').update(content).digest('hex')}"`;

            void redis.setex(cacheKey, 300, etag);
            void redis.setex(`${cacheKey}:response`, 300, JSON.stringify({
              data,
              timestamp: new Date().toISOString(),
            }));

            res.set('ETag', etag);
            res.set('X-Cache', 'MISS');

            return originalJson(data);
          };
        }
      } catch (error) {
        logger.warn('ETag cache error', {
          error: (error as Error).message,
          url: req.originalUrl,
        });
        next();
      }
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(config: Partial<RateLimitConfig> = {}) {
    const defaultConfig: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    };

    const finalConfig = { ...defaultConfig, ...config };

    return (req: Request, res: Response, next: NextFunction): void => {
      const key = `rate_limit:${req.ip}`;
      const now = Date.now();

      // Check existing rate limit
      const existing = this.rateLimitStore.get(key);

      if (!existing || now > existing.resetTime) {
        // New window or expired
        this.rateLimitStore.set(key, {
          count: 1,
          resetTime: now + finalConfig.windowMs,
        });
        return next();
      }

      if (existing.count >= finalConfig.max) {
        // Rate limit exceeded
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          url: req.url,
          count: existing.count,
          max: finalConfig.max,
        });

        res.status(429).json({
          error: finalConfig.message,
          retryAfter: Math.ceil((existing.resetTime - now) / 1000),
        });
        return;
      }

      // Increment counter
      existing.count++;
      next();
    };
  }

  /**
   * Compression middleware for API responses
   */
  compression() {
    const compression = require('compression');

    return compression({
      filter: (req: Request, res: Response) => {
        const encodingHeader = res.getHeader('Content-Encoding');
        if (encodingHeader) {
          return false;
        }

        const header = res.getHeader('Content-Type');
        const contentType = Array.isArray(header)
          ? header.join(',')
          : typeof header === 'string'
          ? header
          : '';

        return contentType.includes('application/json') || contentType.includes('text/');
      },
      threshold: 1024, // Only compress responses larger than 1KB
      level: 6, // Compression level (1-9)
    });
  }

  /**
   * API response time monitoring
   */
  apiResponseMonitor() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = performance.now();

      // Monitor response
      res.on('finish', () => {
        const duration = performance.now() - startTime;

        // Store in Redis for monitoring dashboard
        const key = `api_metrics:${req.method}:${req.route?.path || req.path}`;
        this.redis.lpush(key, JSON.stringify({
          duration: Math.round(duration),
          statusCode: res.statusCode,
          timestamp: new Date().toISOString(),
          ip: typeof req.ip === 'string' ? req.ip : '',
        }));

        // Keep only last 1000 entries per endpoint
        this.redis.ltrim(key, 0, 999);
        this.redis.expire(key, 24 * 60 * 60); // 24 hours

        // Alert on very slow responses
        if (duration > 10000) { // 10 seconds
          logger.error('API response time alert', {
            method: req.method,
            path: req.route?.path || req.path,
            duration: `${Math.round(duration)}ms`,
            statusCode: res.statusCode,
            ip: typeof req.ip === 'string' ? req.ip : '',
          });
        }
      });

      next();
    };
  }

  /**
   * Memory usage monitoring
   */
  memoryMonitor() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const memUsage = process.memoryUsage();

      // Alert on high memory usage
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 500) { // 500MB threshold
        logger.warn('High memory usage detected', {
          heapUsed: `${Math.round(heapUsedMB)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
          route: req.route?.path || req.path,
        });
      }

      // Add memory headers for monitoring
      res.set({
        'X-Memory-Heap-Used': `${Math.round(heapUsedMB)}MB`,
        'X-Memory-Heap-Total': `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      });

      next();
    };
  }

  /**
   * Get performance metrics for monitoring
   */
  async getMetrics(timeframe: 'hour' | 'day' | 'week' = 'hour'): Promise<{
    requests: PerformanceMetrics[];
    averages: {
      responseTime: number;
      requestsPerMinute: number;
      errorRate: number;
      cacheHitRate: number;
    };
    slowestEndpoints: Array<{
      route: string;
      method: string;
      avgDuration: number;
      count: number;
    }>;
  }> {
    const now = new Date();
    const startTime = new Date(now.getTime() - this.getTimeframeMs(timeframe));

    // Filter metrics by timeframe
    const recentMetrics = this.metrics.filter(m => m.timestamp >= startTime);

    // Calculate averages
    const totalRequests = recentMetrics.length;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = (cacheHits / totalRequests) * 100;

    // Group by endpoint for slowest endpoints analysis
    const endpointStats = new Map<string, { totalDuration: number; count: number }>();

    recentMetrics.forEach(m => {
      const key = `${m.method}:${m.route}`;
      if (!endpointStats.has(key)) {
        endpointStats.set(key, { totalDuration: 0, count: 0 });
      }
      const stats = endpointStats.get(key)!;
      stats.totalDuration += m.duration;
      stats.count += 1;
    });

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]): { route: string; method: string; avgDuration: number; count: number } => {
        const [method, route] = endpoint.split(':');
        return {
          route: route || '',
          method: method || '',
          avgDuration: Math.round(stats.totalDuration / stats.count),
          count: stats.count,
        };
      })
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    return {
      requests: recentMetrics,
      averages: {
        responseTime: Math.round(avgResponseTime),
        requestsPerMinute: Math.round(totalRequests / (this.getTimeframeMs(timeframe) / 60000)),
        errorRate: Math.round(errorRate * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      },
      slowestEndpoints,
    };
  }

  /**
   * Health check endpoint
   */
  healthCheck() {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const startTime = performance.now();

        // Check database connection
      const dbHealth = await optimizedDatabase.healthCheck();

      // Check Redis connection
      await this.redis.ping();

        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          uptime: process.uptime(),
          responseTime: `${responseTime}ms`,
          memory: {
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          },
          database: dbHealth?.connected ? 'connected' : 'disconnected',
          redis: 'connected',
        };

        res.json(health);
      } catch (error) {
        logger.error('Health check failed', { error: (error as Error).message });

        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: (error as Error).message,
        });
      }
    };
  }

  /**
   * Helper methods
   */
  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Keep only last 10000 metrics in memory
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  private getTimeframeMs(timeframe: 'hour' | 'day' | 'week'): number {
    switch (timeframe) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Cleanup expired rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now > data.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

export const performanceMiddleware = new PerformanceMiddleware();

// Auto-cleanup rate limits every 5 minutes
setInterval(() => {
  performanceMiddleware.cleanupRateLimits();
}, 5 * 60 * 1000);