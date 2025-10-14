import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { performance } from 'perf_hooks';

interface CacheConfig {
  ttl: number; // Time to live in seconds
  key?: string;
  tags?: string[];
  condition?: (req: Request) => boolean;
  varyOn?: string[]; // Request headers to vary cache on
}

interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  statusCode: number;
  timestamp: Date;
  etag?: string;
}

class CacheMiddleware {
  private redis: Redis;
  private defaultConfig: Partial<CacheConfig> = {
    ttl: 300, // 5 minutes default
    varyOn: ['Authorization'],
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  /**
   * Response caching middleware
   */
  cache(config: Partial<CacheConfig> = {}) {
    const finalConfig = { ...this.defaultConfig, ...config };

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Check cache condition
      if (finalConfig.condition && !finalConfig.condition(req)) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, finalConfig);
      const startTime = performance.now();

      try {
        // Check for cached response
        const cached = await this.getCachedResponse(cacheKey);

        if (cached) {
          // Check If-None-Match header for conditional requests
          const clientETag = req.get('If-None-Match');
          if (clientETag && cached.etag && clientETag === cached.etag) {
            res.status(304).end();
            res.locals.cacheHit = true;
            return;
          }

          // Return cached response
          this.setCachedHeaders(res, cached);
          res.status(cached.statusCode).json(cached.data);
          res.locals.cacheHit = true;

          logger.debug('Cache hit', {
            key: cacheKey,
            duration: `${Math.round(performance.now() - startTime)}ms`,
          });

          return;
        }

        // No cache hit, proceed to generate response
        res.locals.cacheKey = cacheKey;
        res.locals.cacheConfig = finalConfig;

        // Intercept response to cache it
        this.interceptResponse(req, res, cacheKey, finalConfig);

        next();
      } catch (error) {
        logger.warn('Cache middleware error', {
          error: (error as Error).message,
          key: cacheKey,
        });
        next();
      }
    };
  }

  /**
   * Invalidate cache by tags
   */
  invalidateByTags(tags: string[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await this.invalidateCacheByTags(tags);
        logger.debug('Cache invalidated by tags', { tags });
      } catch (error) {
        logger.warn('Cache invalidation failed', {
          error: (error as Error).message,
          tags,
        });
      }
      next();
    };
  }

  /**
   * Cache warming middleware
   */
  warmCache(endpoints: Array<{ path: string; params?: any }>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // This would typically be called by a background job
      // For now, just pass through
      next();
    };
  }

  /**
   * Cache statistics endpoint
   */
  cacheStats() {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const stats = await this.getCacheStats();
        res.json({
          status: 'success',
          data: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to get cache stats', { error: (error as Error).message });
        res.status(500).json({
          status: 'error',
          message: 'Failed to retrieve cache statistics',
        });
      }
    };
  }

  /**
   * Clear cache endpoint
   */
  clearCache() {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const { pattern, tags } = req.body;

        if (tags && Array.isArray(tags)) {
          await this.invalidateCacheByTags(tags);
        } else if (pattern) {
          await this.clearCacheByPattern(pattern);
        } else {
          // Clear all cache
          await this.redis.flushdb();
        }

        logger.info('Cache cleared', { pattern, tags });

        res.json({
          status: 'success',
          message: 'Cache cleared successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to clear cache', { error: (error as Error).message });
        res.status(500).json({
          status: 'error',
          message: 'Failed to clear cache',
        });
      }
    };
  }

  /**
   * Helper methods
   */
  private generateCacheKey(req: Request, config: CacheConfig): string {
    if (config.key) {
      return config.key;
    }

    let key = `cache:${req.method}:${req.originalUrl}`;

    // Add variation parameters
    if (config.varyOn) {
      for (const header of config.varyOn) {
        const value = req.get(header);
        if (value) {
          key += `:${header}:${value}`;
        }
      }
    }

    // Add query parameters
    if (Object.keys(req.query).length > 0) {
      const queryString = new URLSearchParams(req.query as any).toString();
      key += `:query:${queryString}`;
    }

    return key;
  }

  private async getCachedResponse(key: string): Promise<CacheEntry | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Failed to get cached response', {
        error: (error as Error).message,
        key,
      });
      return null;
    }
  }

  private async setCachedResponse(
    key: string,
    entry: CacheEntry,
    config: CacheConfig
  ): Promise<void> {
    try {
      await this.redis.setex(key, config.ttl, JSON.stringify(entry));

      // Add tags for cache invalidation
      if (config.tags) {
        for (const tag of config.tags) {
          await this.redis.sadd(`cache:tags:${tag}`, key);
          await this.redis.expire(`cache:tags:${tag}`, config.ttl);
        }
      }
    } catch (error) {
      logger.warn('Failed to cache response', {
        error: (error as Error).message,
        key,
      });
    }
  }

  private interceptResponse(
    req: Request,
    res: Response,
    cacheKey: string,
    config: CacheConfig
  ): void {
    const originalJson = res.json;
    const originalStatus = res.status;

    let statusCode = 200;
    let responseData: any;
    let responseHeaders: Record<string, string> = {};

    // Capture status code
    res.status = function(this: Response, code: number): Response {
      statusCode = code;
      return originalStatus.call(this, code);
    } as any;

    // Capture JSON response
    res.json = function(this: Response, data: any): Response {
      responseData = data;

      // Generate ETag
      const content = JSON.stringify(data);
      const etag = `"${require('crypto').createHash('md5').update(content).digest('hex')}"`;

      // Cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        const cacheEntry: CacheEntry = {
          data,
          headers: responseHeaders,
          statusCode,
          timestamp: new Date(),
          etag,
        };

        // Set cache asynchronously (don't block response)
        this.setCachedResponse(cacheKey, cacheEntry, config).catch(error => {
          logger.warn('Failed to cache response asynchronously', {
            error: error.message,
            key: cacheKey,
          });
        });

        // Set cache headers
        this.set('ETag', etag);
        this.set('Cache-Control', `public, max-age=${config.ttl}`);
        this.set('X-Cache', 'MISS');
      }

      return originalJson.call(this, data);
    }.bind({ setCachedResponse: this.setCachedResponse.bind(this) });

    // Capture headers
    const originalSet = res.set;
    res.set = function(this: Response, field: any, val?: any): Response {
      const result = originalSet.call(this, field, val);

      if (typeof field === 'string') {
        responseHeaders[field] = val || '';
      } else if (typeof field === 'object') {
        Object.assign(responseHeaders, field);
      }

      return result;
    };
  }

  private setCachedHeaders(res: Response, entry: CacheEntry): void {
    // Set cached headers
    for (const [key, value] of Object.entries(entry.headers)) {
      res.set(key, value);
    }

    // Set cache-specific headers
    res.set('X-Cache', 'HIT');
    res.set('X-Cache-Age', Math.round((Date.now() - entry.timestamp.getTime()) / 1000).toString());

    if (entry.etag) {
      res.set('ETag', entry.etag);
    }
  }

  private async invalidateCacheByTags(tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      const keys = await this.redis.smembers(`cache:tags:${tag}`);
      if (keys.length > 0) {
        pipeline.del(...keys);
        pipeline.del(`cache:tags:${tag}`);
      }
    }

    await pipeline.exec();
  }

  private async clearCacheByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.warn('Failed to clear cache by pattern', {
        error: (error as Error).message,
        pattern,
      });
    }
  }

  private async getCacheStats(): Promise<any> {
    try {
      const [info, keyspace, dbSize] = await Promise.all([
        this.redis.info('memory'),
        this.redis.info('keyspace'),
        this.redis.dbsize(),
      ]);

      const memoryInfo = this.parseRedisInfo(info);
      const keyspaceInfo = this.parseRedisInfo(keyspace);

      // Get cache hit rate
      const stats = await this.redis.info('stats');
      const statsInfo = this.parseRedisInfo(stats);

      return {
        memory: memoryInfo,
        keyspace: keyspaceInfo,
        totalKeys: dbSize,
        hitRate: statsInfo.keyspace_hits && statsInfo.keyspace_misses
          ? Math.round((statsInfo.keyspace_hits / (statsInfo.keyspace_hits + statsInfo.keyspace_misses)) * 100)
          : 0,
        stats: statsInfo,
      };
    } catch (error) {
      logger.warn('Failed to get cache stats', { error: (error as Error).message });
      return null;
    }
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const result: any = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }

    return result;
  }

  /**
   * Cleanup method
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

export const cacheMiddleware = new CacheMiddleware();