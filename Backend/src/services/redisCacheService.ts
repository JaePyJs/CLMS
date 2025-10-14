import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
  tags?: string[];
  etag?: string;
}

interface CacheConfig {
  ttl: number; // Time to live in seconds
  tags?: string[];
  etag?: string;
  priority?: 'low' | 'normal' | 'high';
}

interface CacheStats {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  connectedClients: number;
}

class RedisCacheService {
  private redis: Redis;
  private subscribers: Map<string, Set<Function>> = new Map();
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
      keyPrefix: 'clms:',
      // Connection pooling
      family: 4,
      keepAlive: true,
      // Performance settings
      enableOfflineQueue: false,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.setupEventHandlers();
    this.setupMetricsCollection();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
      this.metrics.errors++;
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  private setupMetricsCollection(): void {
    // Collect metrics every 5 minutes
    setInterval(async () => {
      try {
        const stats = await this.getStats();
        logger.debug('Redis metrics', {
          hitRate: `${stats.hitRate}%`,
          memoryUsage: `${Math.round(stats.memoryUsage / 1024 / 1024)}MB`,
          totalKeys: stats.totalKeys,
        });
      } catch (error) {
        logger.warn('Failed to collect Redis metrics', {
          error: (error as Error).message,
        });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Get value from cache with automatic metrics tracking
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      const cached = await this.redis.get(key);
      const duration = performance.now() - startTime;

      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);

        // Check if expired
        if (Date.now() > entry.expiresAt) {
          await this.delete(key);
          this.metrics.misses++;
          return null;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        await this.redis.set(key, JSON.stringify(entry), 'EX', Math.ceil((entry.expiresAt - Date.now()) / 1000));

        this.metrics.hits++;
        logger.debug('Cache hit', { key, duration: `${Math.round(duration)}ms` });
        return entry.data;
      }

      this.metrics.misses++;
      logger.debug('Cache miss', { key, duration: `${Math.round(duration)}ms` });
      return null;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache get error', { key, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Set value in cache with optional configuration
   */
  async set<T = any>(
    key: string,
    value: T,
    config: Partial<CacheConfig> = {}
  ): Promise<boolean> {
    const startTime = performance.now();
    const finalConfig: CacheConfig = {
      ttl: 300, // 5 minutes default
      priority: 'normal',
      ...config,
    };

    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        data: value,
        expiresAt: now + (finalConfig.ttl * 1000),
        createdAt: now,
        accessCount: 0,
        lastAccessed: now,
        tags: finalConfig.tags,
        etag: finalConfig.etag || this.generateETag(value),
      };

      // Set with expiration
      const result = await this.redis.set(key, JSON.stringify(entry), 'EX', finalConfig.ttl);
      const duration = performance.now() - startTime;

      // Add to tag indexes if tags are provided
      if (finalConfig.tags && finalConfig.tags.length > 0) {
        await this.addToTagIndexes(key, finalConfig.tags, finalConfig.ttl);
      }

      this.metrics.sets++;
      logger.debug('Cache set', {
        key,
        ttl: finalConfig.ttl,
        tags: finalConfig.tags,
        duration: `${Math.round(duration)}ms`
      });

      return result === 'OK';
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache set error', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      // Get entry to remove from tag indexes
      const cached = await this.redis.get(key);
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        if (entry.tags) {
          await this.removeFromTagIndexes(key, entry.tags);
        }
      }

      const result = await this.redis.del(key);
      this.metrics.deletes++;
      return result > 0;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache delete error', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);

        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          totalDeleted += deleted;

          // Remove tag index
          await this.redis.del(tagKey);

          logger.debug('Invalidated cache by tag', { tag, keysCount: keys.length, deleted });
        }
      }

      return totalDeleted;
    } catch (error) {
      logger.error('Cache invalidation error', { tags, error: (error as Error).message });
      return 0;
    }
  }

  /**
   * Get or set pattern (cache-aside pattern)
   */
  async getOrSet<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    config: Partial<CacheConfig> = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    try {
      const data = await fetcher();

      // Cache the result
      await this.set(key, data, config);

      return data;
    } catch (error) {
      logger.error('Failed to fetch and cache data', { key, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Set with write-through pattern (updates cache and database)
   */
  async setWithWriteThrough<T = any>(
    key: string,
    value: T,
    config: Partial<CacheConfig> = {},
    dbUpdater?: () => Promise<void>
  ): Promise<boolean> {
    try {
      // Update database first if updater provided
      if (dbUpdater) {
        await dbUpdater();
      }

      // Then update cache
      return await this.set(key, value, config);
    } catch (error) {
      logger.error('Write-through cache update failed', {
        key,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Batch operations
   */
  async mget<T = any>(keys: string[]): Promise<Array<T | null>> {
    try {
      const values = await this.redis.mget(...keys);
      const results: Array<T | null> = [];

      for (let i = 0; i < keys.length; i++) {
        const value = values[i];
        if (value) {
          try {
            const entry: CacheEntry<T> = JSON.parse(value);

            // Check if expired
            if (Date.now() > entry.expiresAt) {
              await this.delete(keys[i]);
              results.push(null);
            } else {
              results.push(entry.data);
            }
          } catch (parseError) {
            logger.warn('Failed to parse cache entry', {
              key: keys[i],
              error: (parseError as Error).message
            });
            results.push(null);
          }
        } else {
          results.push(null);
        }
      }

      return results;
    } catch (error) {
      logger.error('Batch cache get error', { error: (error as Error).message });
      return new Array(keys.length).fill(null);
    }
  }

  async mset<T = any>(
    entries: Array<{ key: string; value: T; config?: Partial<CacheConfig> }>
  ): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      const now = Date.now();

      for (const { key, value, config = {} } of entries) {
        const finalConfig: CacheConfig = { ttl: 300, ...config };
        const entry: CacheEntry<T> = {
          data: value,
          expiresAt: now + (finalConfig.ttl * 1000),
          createdAt: now,
          accessCount: 0,
          lastAccessed: now,
          tags: finalConfig.tags,
          etag: finalConfig.etag || this.generateETag(value),
        };

        pipeline.set(key, JSON.stringify(entry), 'EX', finalConfig.ttl);

        // Add to tag indexes
        if (finalConfig.tags) {
          for (const tag of finalConfig.tags) {
            pipeline.sadd(`tag:${tag}`, key);
            pipeline.expire(`tag:${tag}`, finalConfig.ttl);
          }
        }
      }

      const results = await pipeline.exec();
      const success = results?.every(result => result[0] === null);

      if (success) {
        this.metrics.sets += entries.length;
      }

      return success || false;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Batch cache set error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Cache warming
   */
  async warmCache(entries: Array<{ key: string; fetcher: () => Promise<any>; config?: Partial<CacheConfig> }>): Promise<void> {
    logger.info('Starting cache warming', { entriesCount: entries.length });

    const promises = entries.map(async ({ key, fetcher, config }) => {
      try {
        // Check if already cached
        const cached = await this.get(key);
        if (cached !== null) {
          return; // Skip if already cached
        }

        // Fetch and cache
        const data = await fetcher();
        await this.set(key, data, config);

        logger.debug('Cache warmed', { key });
      } catch (error) {
        logger.warn('Failed to warm cache entry', {
          key,
          error: (error as Error).message
        });
      }
    });

    await Promise.allSettled(promises);
    logger.info('Cache warming completed');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const stats = await this.redis.info('stats');
      const clients = await this.redis.info('clients');

      const memoryInfo = this.parseRedisInfo(info);
      const statsInfo = this.parseRedisInfo(stats);
      const clientsInfo = this.parseRedisInfo(clients);

      const keyspaceHits = statsInfo.keyspace_hits || 0;
      const keyspaceMisses = statsInfo.keyspace_misses || 0;
      const totalRequests = keyspaceHits + keyspaceMisses;

      return {
        totalKeys: await this.redis.dbsize(),
        memoryUsage: memoryInfo.used_memory || 0,
        hitRate: totalRequests > 0 ? (keyspaceHits / totalRequests) * 100 : 0,
        missRate: totalRequests > 0 ? (keyspaceMisses / totalRequests) * 100 : 0,
        evictions: statsInfo.evicted_keys || 0,
        keyspaceHits,
        keyspaceMisses,
        connectedClients: clientsInfo.connected_clients || 0,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error: (error as Error).message });
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        missRate: 0,
        evictions: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
        connectedClients: 0,
      };
    }
  }

  /**
   * Get application-level metrics
   */
  getMetrics() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.metrics.misses / totalRequests) * 100 : 0,
    };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      const result = await this.redis.flushdb();
      logger.info('Cache cleared');
      return result === 'OK';
    } catch (error) {
      logger.error('Failed to clear cache', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 1000 ? 'healthy' : 'unhealthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Subscribe to cache events
   */
  subscribe(pattern: string, callback: (channel: string, message: string) => void): () => void {
    if (!this.subscribers.has(pattern)) {
      this.subscribers.set(pattern, new Set());
    }

    this.subscribers.get(pattern)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(pattern);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(pattern);
        }
      }
    };
  }

  /**
   * Publish cache event
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.redis.publish(channel, message);
    } catch (error) {
      logger.error('Failed to publish cache event', {
        channel,
        error: (error as Error).message
      });
      return 0;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Helper methods
   */
  private generateETag(data: any): string {
    const content = JSON.stringify(data);
    return `"${createHash('md5').update(content).digest('hex')}"`;
  }

  private async addToTagIndexes(key: string, tags: string[], ttl: number): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
      pipeline.expire(`tag:${tag}`, ttl);
    }

    await pipeline.exec();
  }

  private async removeFromTagIndexes(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      pipeline.srem(`tag:${tag}`, key);
    }

    await pipeline.exec();
  }

  private parseRedisInfo(info: string): Record<string, number> {
    const lines = info.split('\r\n');
    const result: Record<string, number> = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(Number(value)) ? 0 : Number(value);
        }
      }
    }

    return result;
  }
}

// Create singleton instance
export const redisCacheService = new RedisCacheService();

// Export class for testing
export { RedisCacheService };

// Export types
export type { CacheConfig, CacheStats, CacheEntry };