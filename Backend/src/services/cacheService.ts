import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
}

export class CacheService {
  private static instance: Redis | null = null;
  private static isRedisAvailable = false;

  /**
   * Get or create Redis connection
   */
  private static getRedisClient(): Redis | null {
    if (!env.REDIS_URL) {
      logger.warn('Redis URL not configured, caching disabled');
      return null;
    }

    if (!this.instance) {
      try {
        this.instance = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });

        this.instance.on('connect', () => {
          logger.info('Redis cache connected');
          this.isRedisAvailable = true;
        });

        this.instance.on('error', (error: Error) => {
          logger.error('Redis cache error', { error: error.message });
          this.isRedisAvailable = false;
        });

        this.instance.on('close', () => {
          logger.warn('Redis cache connection closed');
          this.isRedisAvailable = false;
        });
      } catch (error) {
        logger.error('Failed to initialize Redis cache', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.isRedisAvailable = false;
      }
    }

    return this.instance;
  }

  /**
   * Check if Redis is available
   */
  public static isAvailable(): boolean {
    return this.isRedisAvailable;
  }

  /**
   * Generate cache key with namespace
   */
  private static generateKey(namespace: string, key: string): string {
    return `clms:${namespace}:${key}`;
  }

  /**
   * Get value from cache
   */
  public static async get<T = unknown>(
    namespace: string,
    key: string,
  ): Promise<T | null> {
    const redis = this.getRedisClient();
    if (!redis || !this.isRedisAvailable) {
      return null;
    }

    try {
      const cacheKey = this.generateKey(namespace, key);
      const value = await redis.get(cacheKey);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', {
        namespace,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public static async set(
    namespace: string,
    key: string,
    value: unknown,
    options: CacheOptions = {},
  ): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis || !this.isRedisAvailable) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(namespace, key);
      const serialized = JSON.stringify(value);
      const ttl = options.ttl || 300; // Default 5 minutes

      await redis.setex(cacheKey, ttl, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error', {
        namespace,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public static async del(namespace: string, key: string): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis || !this.isRedisAvailable) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(namespace, key);
      const result = await redis.del(cacheKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', {
        namespace,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Delete all values in a namespace
   */
  public static async flushNamespace(namespace: string): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis || !this.isRedisAvailable) {
      return false;
    }

    try {
      const pattern = this.generateKey(namespace, '*');
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return true;
      }

      await redis.del(...keys);
      return true;
    } catch (error) {
      logger.error('Cache flush namespace error', {
        namespace,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Cache-aside pattern: Get from cache or compute and store
   */
  public static async getOrSet<T>(
    namespace: string,
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss, fetch data
    const data = await fetcher();

    // Store in cache asynchronously
    this.set(namespace, key, data, options).catch(error => {
      logger.error('Cache store error', {
        namespace,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    return data;
  }

  /**
   * Invalidate cache when data changes
   */
  public static async invalidate(
    patterns: Array<{ namespace: string; pattern: string }>,
  ): Promise<void> {
    const redis = this.getRedisClient();
    if (!redis || !this.isRedisAvailable) {
      return;
    }

    try {
      const pipeline = redis.pipeline();

      for (const { namespace, pattern } of patterns) {
        const fullPattern = this.generateKey(namespace, pattern);
        const keys = await redis.keys(fullPattern);

        if (keys.length > 0) {
          pipeline.del(...keys);
        }
      }

      await pipeline.exec();
    } catch (error) {
      logger.error('Cache invalidation error', {
        patterns,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get cache statistics
   */
  public static async getStats(): Promise<{
    available: boolean;
    connected: boolean;
    memory?: string;
    keys?: number;
  }> {
    const redis = this.getRedisClient();
    if (!redis || !this.isRedisAvailable) {
      return {
        available: false,
        connected: false,
      };
    }

    try {
      const info = await redis.info('memory');
      const keyCount = await redis.dbsize();

      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1] : undefined;

      return {
        available: true,
        connected: true,
        memory,
        keys: keyCount,
      };
    } catch (error) {
      logger.error('Cache stats error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        available: true,
        connected: false,
      };
    }
  }

  /**
   * Graceful shutdown
   */
  public static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
      this.isRedisAvailable = false;
      logger.info('Redis cache disconnected');
    }
  }
}

// Export singleton instance helper
export const cache = CacheService;
