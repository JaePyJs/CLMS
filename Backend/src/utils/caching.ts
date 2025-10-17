import Redis from 'ioredis';
import { logger } from './logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  tags?: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

class CacheManager {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { value: any; expires: number; tags: string[] }> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };
  private useRedis: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeRedis();
    this.startCleanup();
  }

  private initializeRedis() {
    try {
      if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
        this.redis = new Redis({
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT, 10),
          password: process.env.REDIS_PASSWORD || undefined,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn('Redis connection failed, falling back to memory cache');
              return null;
            }
            return Math.min(times * 100, 3000);
          }
        });

        this.redis.on('connect', () => {
          this.useRedis = true;
          logger.info('Redis cache connected');
        });

        this.redis.on('error', (error) => {
          logger.warn('Redis error, using memory cache:', error.message);
          this.useRedis = false;
        });
      } else {
        logger.info('Redis not configured, using memory cache');
      }
    } catch (error) {
      logger.warn('Failed to initialize Redis:', error);
    }
  }

  private startCleanup() {
    // Clean expired memory cache entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expires < now) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug(`Cleaned ${cleaned} expired cache entries`);
      }
    }, 5 * 60 * 1000);
  }

  private getCacheKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const cacheKey = this.getCacheKey(key, options.prefix);

    try {
      if (this.useRedis && this.redis) {
        const value = await this.redis.get(cacheKey);
        if (value !== null) {
          this.stats.hits++;
          return JSON.parse(value) as T;
        }
      } else {
        const entry = this.memoryCache.get(cacheKey);
        if (entry && entry.expires > Date.now()) {
          this.stats.hits++;
          return entry.value as T;
        } else if (entry) {
          this.memoryCache.delete(cacheKey);
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.getCacheKey(key, options.prefix);
    const ttl = options.ttl || 3600; // Default 1 hour
    const tags = options.tags || [];

    try {
      if (this.useRedis && this.redis) {
        const serialized = JSON.stringify(value);
        await this.redis.setex(cacheKey, ttl, serialized);

        // Store tags for invalidation
        if (tags.length > 0) {
          for (const tag of tags) {
            await this.redis.sadd(`tag:${tag}`, cacheKey);
            await this.redis.expire(`tag:${tag}`, ttl);
          }
        }
      } else {
        this.memoryCache.set(cacheKey, {
          value,
          expires: Date.now() + (ttl * 1000),
          tags
        });
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.getCacheKey(key, options.prefix);

    try {
      if (this.useRedis && this.redis) {
        await this.redis.del(cacheKey);
      } else {
        this.memoryCache.delete(cacheKey);
      }

      this.stats.deletes++;
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    let invalidated = 0;

    try {
      if (this.useRedis && this.redis) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(`tag:${tag}`);
          invalidated = keys.length;
        }
      } else {
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.tags.includes(tag)) {
            this.memoryCache.delete(key);
            invalidated++;
          }
        }
      }

      logger.debug(`Invalidated ${invalidated} cache entries with tag: ${tag}`);
      return invalidated;
    } catch (error) {
      logger.error('Cache invalidate by tag error:', error);
      return 0;
    }
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    let invalidated = 0;

    try {
      if (this.useRedis && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          invalidated = keys.length;
        }
      } else {
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
            invalidated++;
          }
        }
      }

      logger.debug(`Invalidated ${invalidated} cache entries matching pattern: ${pattern}`);
      return invalidated;
    } catch (error) {
      logger.error('Cache invalidate by pattern error:', error);
      return 0;
    }
  }

  async clear(): Promise<boolean> {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.flushdb();
      } else {
        this.memoryCache.clear();
      }

      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  getStats(): CacheStats & { size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      size: this.memoryCache.size,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Not in cache, fetch from factory
    const value = await factory();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redis) {
      this.redis.disconnect();
    }

    this.memoryCache.clear();
    logger.info('Cache manager shut down');
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Decorator for caching method results
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      return cacheManager.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

// Helper function for query result caching
export async function cacheQuery<T>(
  key: string,
  query: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  return cacheManager.getOrSet(key, query, { ttl });
}

export default cacheManager;
