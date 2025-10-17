import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { cacheManager } from '@/utils/caching';
import { CacheManager } from '@/cache/cacheManager';
import { performanceMonitoringService } from '@/services/performanceMonitoringService';

/**
 * Cache Strategy Types
 */
export enum CacheStrategy {
  WRITE_THROUGH = 'write-through',
  WRITE_BEHIND = 'write-behind',
  WRITE_AROUND = 'write-around',
  REFRESH_AHEAD = 'refresh-ahead',
  CACHE_ASIDE = 'cache-aside',
  READ_THROUGH = 'read-through',
}

/**
 * Cache Invalidation Strategy
 */
export enum InvalidationStrategy {
  TIME_BASED = 'time-based',
  EVENT_BASED = 'event-based',
  TAG_BASED = 'tag-based',
  MANUAL = 'manual',
}

/**
 * Cache Configuration
 */
export interface CacheConfig {
  strategy: CacheStrategy;
  invalidationStrategy: InvalidationStrategy;
  ttl: number; // Time to live in seconds
  maxSize?: number; // Maximum number of items in cache
  refreshThreshold?: number; // Percentage of TTL after which to refresh
  enableMetrics?: boolean;
  enableCompression?: boolean;
  enableEncryption?: boolean;
}

/**
 * Cache Entry
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Cache Statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  refreshes: number;
  size: number;
  hitRate: number;
  avgAccessTime: number;
  memoryUsage: number;
}

/**
 * Advanced Caching Service
 *
 * Provides sophisticated caching strategies including multi-level caching,
 * intelligent invalidation, and performance optimization.
 */
export class AdvancedCachingService extends EventEmitter {
  private cacheManager: CacheManager;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private cacheConfigs: Map<string, CacheConfig> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private statistics: CacheStatistics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    refreshes: 0,
    size: 0,
    hitRate: 0,
    avgAccessTime: 0,
    memoryUsage: 0,
  };
  private isInitialized: boolean = false;

  constructor(cacheManager: CacheManager) {
    super();
    this.cacheManager = cacheManager;
  }

  /**
   * Initialize the advanced caching service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Advanced caching service is already initialized');
      return;
    }

    // Set up periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute

    // Set up statistics reporting
    setInterval(() => {
      this.reportStatistics();
    }, 300000); // Every 5 minutes

    this.isInitialized = true;
    logger.info('Advanced caching service initialized');
    this.emit('initialized');
  }

  /**
   * Configure caching for a specific key pattern
   */
  configureCache(keyPattern: string, config: CacheConfig): void {
    this.cacheConfigs.set(keyPattern, config);
    logger.debug(`Cache configuration updated for pattern: ${keyPattern}`);
  }

  /**
   * Get a value from cache with advanced strategies
   */
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options?: {
      tags?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<T | null> {
    const startTime = Date.now();
    const config = this.getConfigForKey(key);

    try {
      // Try to get from memory cache first
      let entry = this.memoryCache.get(key);

      if (entry && !this.isExpired(entry)) {
        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        this.statistics.hits++;
        this.updateStatistics();

        // Check if we should refresh ahead
        if (
          config.strategy === CacheStrategy.REFRESH_AHEAD &&
          config.refreshThreshold &&
          this.shouldRefresh(entry, config)
        ) {
          this.refreshInBackground(key, fetcher, config);
        }

        return entry.value as T;
      }

      // If not in memory or expired, try to get from distributed cache
      if (entry && this.isExpired(entry)) {
        this.memoryCache.delete(key);
        entry = undefined;
      }

      if (!entry) {
        let value: string | null = null;

        try {
          value = await this.cacheManager.get(key);
        } catch (error) {
          logger.warn('Failed to get from distributed cache', {
            key,
            error: (error as Error).message,
          });
        }

        if (value) {
          try {
            const parsedValue = JSON.parse(value) as T;

            // Store in memory cache
            const cacheEntry: CacheEntry<T> = {
              key,
              value: parsedValue,
              timestamp: Date.now(),
              ttl: config.ttl * 1000,
              accessCount: 1,
              lastAccessed: Date.now(),
            };
            if (options?.tags) cacheEntry.tags = options.tags;
            if (options?.metadata) cacheEntry.metadata = options.metadata;

            this.memoryCache.set(key, cacheEntry);

            this.statistics.hits++;
            this.updateStatistics();

            return parsedValue;
          } catch (parseError) {
            logger.error('Failed to parse cached value', {
              key,
              error: (parseError as Error).message,
            });
          }
        }
      }

      // If still not found and fetcher is provided, use appropriate strategy
      if (!entry && fetcher) {
        this.statistics.misses++;
        this.updateStatistics();

        switch (config.strategy) {
          case CacheStrategy.READ_THROUGH:
          case CacheStrategy.CACHE_ASIDE:
            return await this.getWithCacheAside(key, fetcher, config, options);

          default:
            return await this.getWithCacheAside(key, fetcher, config, options);
        }
      }

      return null;
    } finally {
      const duration = Date.now() - startTime;
      this.statistics.avgAccessTime =
        (this.statistics.avgAccessTime + duration) / 2;

      // Record performance metric
      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'get',
        duration,
        success: true,
        metadata: { key, strategy: config.strategy },
      });
    }
  }

  /**
   * Set a value in cache with advanced strategies
   */
  async set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    const startTime = Date.now();
    const config = this.getConfigForKey(key);
    const ttl = options?.ttl || config.ttl;

    try {
      switch (config.strategy) {
        case CacheStrategy.WRITE_THROUGH:
          await this.setWriteThrough(key, value, ttl, options);
          break;

        case CacheStrategy.WRITE_BEHIND:
          await this.setWriteBehind(key, value, ttl, options);
          break;

        case CacheStrategy.WRITE_AROUND:
          await this.setWriteAround(key, value, ttl, options);
          break;

        default:
          await this.setWriteThrough(key, value, ttl, options);
      }

      this.statistics.sets++;
      this.updateStatistics();
    } catch (error) {
      logger.error('Failed to set in cache', {
        key,
        error: (error as Error).message,
      });

      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'set',
        duration: Date.now() - startTime,
        success: false,
        metadata: { key, error: (error as Error).message },
      });

      throw error;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Delete from memory cache
      this.memoryCache.delete(key);

      // Delete from distributed cache
      await this.cacheManager.del(key);

      // Clear any refresh timer
      const timer = this.refreshTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.refreshTimers.delete(key);
      }

      this.statistics.deletes++;
      this.updateStatistics();

      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'delete',
        duration: Date.now() - startTime,
        success: true,
        metadata: { key },
      });
    } catch (error) {
      logger.error('Failed to delete from cache', {
        key,
        error: (error as Error).message,
      });

      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'delete',
        duration: Date.now() - startTime,
        success: false,
        metadata: { key, error: (error as Error).message },
      });
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      // Invalidate from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags && entry.tags.includes(tag)) {
          this.memoryCache.delete(key);
          invalidatedCount++;
        }
      }

      // Invalidate from distributed cache
      const distributedInvalidated = await cacheManager.invalidateByTag(tag);
      invalidatedCount += distributedInvalidated;

      this.statistics.deletes += invalidatedCount;
      this.updateStatistics();

      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'invalidateByTag',
        duration: Date.now() - startTime,
        success: true,
        metadata: { tag, count: invalidatedCount },
      });

      return invalidatedCount;
    } catch (error) {
      logger.error('Failed to invalidate by tag', {
        tag,
        error: (error as Error).message,
      });

      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'invalidateByTag',
        duration: Date.now() - startTime,
        success: false,
        metadata: { tag, error: (error as Error).message },
      });

      return 0;
    }
  }

  /**
   * Warm up cache with predefined entries
   */
  async warmCache(
    entries: Array<{
      key: string;
      fetcher: () => Promise<any>;
      options?: {
        ttl?: number;
        tags?: string[];
        metadata?: Record<string, any>;
      };
    }>,
  ): Promise<void> {
    logger.info(`Warming cache with ${entries.length} entries`);

    const promises = entries.map(async entry => {
      try {
        await this.get(entry.key, entry.fetcher, entry.options);
      } catch (error) {
        logger.error(`Failed to warm cache entry: ${entry.key}`, {
          error: (error as Error).message,
        });
      }
    });

    await Promise.all(promises);
    logger.info('Cache warming completed');
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get configuration for a specific key
   */
  private getConfigForKey(key: string): CacheConfig {
    // Find matching configuration
    for (const [pattern, config] of this.cacheConfigs.entries()) {
      if (key.match(pattern)) {
        return config;
      }
    }

    // Return default configuration
    return {
      strategy: CacheStrategy.CACHE_ASIDE,
      invalidationStrategy: InvalidationStrategy.TIME_BASED,
      ttl: 3600, // 1 hour
      enableMetrics: true,
    };
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Check if a cache entry should be refreshed
   */
  private shouldRefresh(entry: CacheEntry<any>, config: CacheConfig): boolean {
    if (!config.refreshThreshold) return false;

    const age = Date.now() - entry.timestamp;
    const refreshTime = entry.ttl * config.refreshThreshold;

    return age > refreshTime;
  }

  /**
   * Refresh a cache entry in the background
   */
  private async refreshInBackground<T>(
    key: string,
    fetcher?: () => Promise<T>,
    config?: CacheConfig,
  ): Promise<void> {
    if (!fetcher) return;

    // Clear existing timer
    const existingTimer = this.refreshTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      try {
        const value = await fetcher();
        await this.set(key, value);
        this.statistics.refreshes++;
        this.updateStatistics();
        logger.debug(`Cache entry refreshed: ${key}`);
      } catch (error) {
        logger.error(`Failed to refresh cache entry: ${key}`, {
          error: (error as Error).message,
        });
      } finally {
        this.refreshTimers.delete(key);
      }
    }, 100); // Small delay to avoid blocking

    this.refreshTimers.set(key, timer);
  }

  /**
   * Get with cache-aside pattern
   */
  private async getWithCacheAside<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig,
    options?: {
      tags?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<T> {
    // Fetch from source
    const value = await fetcher();

    // Store in cache
    const setOptions: any = { ttl: config.ttl };
    if (options?.tags) setOptions.tags = options.tags;
    if (options?.metadata) setOptions.metadata = options.metadata;

    await this.set(key, value, setOptions);

    return value;
  }

  /**
   * Set with write-through pattern
   */
  private async setWriteThrough<T>(
    key: string,
    value: T,
    ttl: number,
    options?: {
      tags?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    // Store in memory cache
    const cacheEntry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000,
      accessCount: 0,
      lastAccessed: Date.now(),
    };
    if (options?.tags) cacheEntry.tags = options.tags;
    if (options?.metadata) cacheEntry.metadata = options.metadata;

    this.memoryCache.set(key, cacheEntry);

    // Store in distributed cache
    await this.cacheManager.set(key, JSON.stringify(value), ttl * 1000);

    // Store tags if provided
    if (options?.tags) {
      for (const tag of options.tags) {
        await this.cacheManager.hset(`tags:${tag}`, key, '1');
        await this.cacheManager.expire(`tags:${tag}`, ttl * 1000);
      }
    }
  }

  /**
   * Set with write-behind pattern (async)
   */
  private async setWriteBehind<T>(
    key: string,
    value: T,
    ttl: number,
    options?: {
      tags?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    // Store in memory cache immediately
    const cacheEntry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000,
      accessCount: 0,
      lastAccessed: Date.now(),
    };
    if (options?.tags) cacheEntry.tags = options.tags;
    if (options?.metadata) cacheEntry.metadata = options.metadata;

    this.memoryCache.set(key, cacheEntry);

    // Store in distributed cache asynchronously
    setImmediate(async () => {
      try {
        await this.cacheManager.set(key, JSON.stringify(value), ttl * 1000);

        // Store tags if provided
        if (options?.tags) {
          for (const tag of options.tags) {
            await this.cacheManager.hset(`tags:${tag}`, key, '1');
            await this.cacheManager.expire(`tags:${tag}`, ttl * 1000);
          }
        }
      } catch (error) {
        logger.error('Failed to write behind to distributed cache', {
          key,
          error: (error as Error).message,
        });
      }
    });
  }

  /**
   * Set with write-around pattern (skip cache)
   */
  private async setWriteAround<T>(
    key: string,
    value: T,
    ttl: number,
    options?: {
      tags?: string[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    // Only store in distributed cache, not in memory cache
    await this.cacheManager.set(key, JSON.stringify(value), ttl * 1000);

    // Store tags if provided
    if (options?.tags) {
      for (const tag of options.tags) {
        await this.cacheManager.hset(`tags:${tag}`, key, '1');
        await this.cacheManager.expire(`tags:${tag}`, ttl * 1000);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let evictedCount = 0;

    // Clean up memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        evictedCount++;
      }
    }

    // Clean up refresh timers
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        const timer = this.refreshTimers.get(key);
        if (timer) {
          clearTimeout(timer);
          this.refreshTimers.delete(key);
        }
      }
    }

    if (evictedCount > 0) {
      this.statistics.evictions += evictedCount;
      this.updateStatistics();
      logger.debug(`Cleaned up ${evictedCount} expired cache entries`);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStatistics(): void {
    this.statistics.size = this.memoryCache.size;
    this.statistics.hitRate =
      this.statistics.hits / (this.statistics.hits + this.statistics.misses) ||
      0;

    // Calculate memory usage (rough estimate)
    let memoryUsage = 0;
    for (const entry of this.memoryCache.values()) {
      memoryUsage += JSON.stringify(entry.value).length;
    }
    this.statistics.memoryUsage = memoryUsage;
  }

  /**
   * Report cache statistics
   */
  private reportStatistics(): void {
    logger.info('Cache Statistics', {
      hits: this.statistics.hits,
      misses: this.statistics.misses,
      hitRate: `${(this.statistics.hitRate * 100).toFixed(2)}%`,
      size: this.statistics.size,
      evictions: this.statistics.evictions,
      refreshes: this.statistics.refreshes,
      memoryUsage: `${(this.statistics.memoryUsage / 1024).toFixed(2)} KB`,
    });

    this.emit('statistics', this.statistics);
  }
}

// Singleton instance
export let advancedCachingService: AdvancedCachingService;

export function initializeAdvancedCachingService(
  cacheManager: CacheManager,
): void {
  advancedCachingService = new AdvancedCachingService(cacheManager);
  advancedCachingService.initialize();
}
