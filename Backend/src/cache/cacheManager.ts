import { EventEmitter } from 'events';
import Redis from 'ioredis';
import {
  InMemoryCache,
  MemoryCacheConfig,
  EvictionPolicy,
} from './memoryCache';
import { logger } from '../utils/logger';
import { RedisConfigurationFactory } from '../config/redis.config';

type RedisEnvironment = Parameters<
  typeof RedisConfigurationFactory.getRedisClient
>[1];

// Cache provider types
export enum CacheProvider {
  REDIS = 'redis',
  MEMORY = 'memory',
}

// Cache manager configuration
export interface CacheManagerConfig {
  redisInstanceName?: string;
  redisEnvironment?: RedisEnvironment;
  memoryCacheConfig?: MemoryCacheConfig;
  healthCheckInterval?: number;
  failoverTimeout?: number;
  enableDataSync?: boolean;
  syncBatchSize?: number;
  syncRetryAttempts?: number;
  criticalKeys?: string[];
}

// Health status
export interface HealthStatus {
  provider: CacheProvider;
  isHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  lastError?: string;
  responseTime?: number;
}

// Sync statistics
export interface SyncStats {
  totalSynced: number;
  syncErrors: number;
  lastSyncTime: number;
  syncInProgress: boolean;
}

type CacheEventMap = {
  get: { key: string; hit: boolean; responseTime: number };
  set: { key: string; responseTime: number };
};

/**
 * Cache manager that seamlessly switches between Redis and in-memory cache
 * Provides automatic failover and recovery mechanisms
 */
export class CacheManager extends EventEmitter {
  private redisClient: Redis | null = null;
  private memoryCache: InMemoryCache;
  private currentProvider: CacheProvider;
  private config: Required<CacheManagerConfig>;
  private healthStatus: HealthStatus;
  private syncStats: SyncStats;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private failoverTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: CacheManagerConfig = {}) {
    super();
    this.config = {
      redisInstanceName: config.redisInstanceName || 'default',
      redisEnvironment: config.redisEnvironment || 'development',
      memoryCacheConfig: {
        maxSize: config.memoryCacheConfig?.maxSize || 2000,
        evictionPolicy:
          config.memoryCacheConfig?.evictionPolicy || EvictionPolicy.LRU,
        defaultTTL: config.memoryCacheConfig?.defaultTTL || 3600000,
        cleanupInterval: config.memoryCacheConfig?.cleanupInterval || 60000,
        enableMetrics: config.memoryCacheConfig?.enableMetrics !== false,
        persistCriticalData:
          config.memoryCacheConfig?.persistCriticalData || true,
        persistKeyPrefix:
          config.memoryCacheConfig?.persistKeyPrefix || 'critical:',
      },
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      failoverTimeout: config.failoverTimeout || 5000, // 5 seconds
      enableDataSync: config.enableDataSync !== false,
      syncBatchSize: config.syncBatchSize || 100,
      syncRetryAttempts: config.syncRetryAttempts || 3,
      criticalKeys: config.criticalKeys || [],
    };

    this.memoryCache = new InMemoryCache(this.config.memoryCacheConfig);
    this.currentProvider = CacheProvider.REDIS; // Start with Redis by default

    this.healthStatus = {
      provider: CacheProvider.REDIS,
      isHealthy: false,
      lastCheck: 0,
      consecutiveFailures: 0,
    };

    this.syncStats = {
      totalSynced: 0,
      syncErrors: 0,
      lastSyncTime: 0,
      syncInProgress: false,
    };

    logger.info('CacheManager initialized', {
      redisInstanceName: this.config.redisInstanceName,
      healthCheckInterval: this.config.healthCheckInterval,
      failoverTimeout: this.config.failoverTimeout,
      enableDataSync: this.config.enableDataSync,
    });
  }

  override on<T extends keyof CacheEventMap>(
    event: T,
    listener: (payload: CacheEventMap[T]) => void,
  ): this {
    return super.on(event, listener);
  }

  override emit<T extends keyof CacheEventMap>(
    event: T,
    payload: CacheEventMap[T],
  ): boolean {
    return super.emit(event, payload);
  }

  /**
   * Initialize the cache manager and establish Redis connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CacheManager already initialized');
      return;
    }

    try {
      // Try to connect to Redis
      await this.connectToRedis();

      // Start health checks
      this.startHealthChecks();

      this.isInitialized = true;
      logger.info('CacheManager initialized successfully', {
        provider: this.currentProvider,
      });
    } catch (error) {
      logger.error(
        'Failed to initialize CacheManager with Redis, falling back to memory cache',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      // Fallback to memory cache
      this.currentProvider = CacheProvider.MEMORY;
      this.healthStatus.provider = CacheProvider.MEMORY;
      this.healthStatus.isHealthy = true;

      // Start health checks to monitor Redis recovery
      this.startHealthChecks();

      this.isInitialized = true;
      logger.info('CacheManager initialized with memory cache fallback');
    }
  }

  /**
   * Get value from cache (transparent provider switching)
   */
  async get(key: string): Promise<string | null> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        const result = await this.redisClient.get(key);
        const responseTime = Date.now() - startTime;

        if (this.healthStatus.isHealthy) {
          this.healthStatus.responseTime = responseTime;
        }

        this.emit('get', { key, hit: result !== null, responseTime });
        return result;
      } else {
        // Use memory cache
        const result = await this.memoryCache.get(key);
        const responseTime = Date.now() - startTime;
        this.emit('get', { key, hit: result !== null, responseTime });
        return result;
      }
    } catch (error) {
      logger.error('Cache get operation failed', {
        provider: this.currentProvider,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      // If Redis operation failed, try to failover
      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        // Retry with memory cache
        const fallbackResult = await this.memoryCache.get(key);
        const responseTime = Date.now() - startTime;
        this.emit('get', { key, hit: fallbackResult !== null, responseTime });
        return fallbackResult;
      }

      const responseTime = Date.now() - startTime;
      this.emit('get', { key, hit: false, responseTime });
      return null;
    }
  }

  /**
   * Set value in cache (transparent provider switching)
   */
  async set(key: string, value: unknown, ttl?: number): Promise<'OK'> {
    this.ensureInitialized();
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    const startTime = Date.now();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        let result: 'OK';

        if (ttl) {
          result = await this.redisClient.set(
            key,
            stringValue,
            'EX',
            Math.ceil(ttl / 1000),
          );
        } else {
          result = await this.redisClient.set(key, stringValue);
        }

        const responseTime = Date.now() - startTime;

        if (this.healthStatus.isHealthy) {
          this.healthStatus.responseTime = responseTime;
        }

        this.emit('set', { key, responseTime });
        return result;
      } else {
        // Use memory cache
        const result = await this.memoryCache.set(key, stringValue, ttl);
        const responseTime = Date.now() - startTime;
        this.emit('set', { key, responseTime });
        return result;
      }
    } catch (error) {
      logger.error('Cache set operation failed', {
        provider: this.currentProvider,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      // If Redis operation failed, try to failover
      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        // Retry with memory cache
        const fallbackResult = await this.memoryCache.set(
          key,
          stringValue,
          ttl,
        );
        const responseTime = Date.now() - startTime;
        this.emit('set', { key, responseTime });
        return fallbackResult;
      }

      const responseTime = Date.now() - startTime;
      this.emit('set', { key, responseTime });
      throw error;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.del(key);
      } else {
        return await this.memoryCache.del(key);
      }
    } catch (error) {
      logger.error('Cache delete operation failed', {
        provider: this.currentProvider,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.del(key);
      }

      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.exists(key);
      } else {
        return await this.memoryCache.exists(key);
      }
    } catch (error) {
      logger.error('Cache exists operation failed', {
        provider: this.currentProvider,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.exists(key);
      }

      return 0;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.expire(key, Math.ceil(ttl / 1000));
      } else {
        return await this.memoryCache.expire(key, ttl);
      }
    } catch (error) {
      logger.error('Cache expire operation failed', {
        provider: this.currentProvider,
        key,
        ttl,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.expire(key, ttl);
      }

      return 0;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.ttl(key);
      } else {
        return await this.memoryCache.ttl(key);
      }
    } catch (error) {
      logger.error('Cache TTL operation failed', {
        provider: this.currentProvider,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.ttl(key);
      }

      return -2;
    }
  }

  /**
   * Hash operations - get field from hash
   */
  async hget(key: string, field: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.hget(key, field);
      } else {
        return await this.memoryCache.hget(key, field);
      }
    } catch (error) {
      logger.error('Cache hget operation failed', {
        provider: this.currentProvider,
        key,
        field,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.hget(key, field);
      }

      return null;
    }
  }

  /**
   * Hash operations - set field in hash
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.hset(key, field, value);
      } else {
        return await this.memoryCache.hset(key, field, value);
      }
    } catch (error) {
      logger.error('Cache hset operation failed', {
        provider: this.currentProvider,
        key,
        field,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.hset(key, field, value);
      }

      return 0;
    }
  }

  /**
   * Hash operations - delete field from hash
   */
  async hdel(key: string, field: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.hdel(key, field);
      } else {
        return await this.memoryCache.hdel(key, field);
      }
    } catch (error) {
      logger.error('Cache hdel operation failed', {
        provider: this.currentProvider,
        key,
        field,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.hdel(key, field);
      }

      return 0;
    }
  }

  /**
   * Hash operations - check if field exists
   */
  async hexists(key: string, field: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.hexists(key, field);
      } else {
        return await this.memoryCache.hexists(key, field);
      }
    } catch (error) {
      logger.error('Cache hexists operation failed', {
        provider: this.currentProvider,
        key,
        field,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.hexists(key, field);
      }

      return 0;
    }
  }

  /**
   * Get multiple values
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.mget(...keys);
      } else {
        return await this.memoryCache.mget(...keys);
      }
    } catch (error) {
      logger.error('Cache mget operation failed', {
        provider: this.currentProvider,
        keys,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.mget(...keys);
      }

      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values
   */
  async mset(keyValues: [string, string][]): Promise<'OK'> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        const flatArgs: string[] = [];
        for (const [key, value] of keyValues) {
          flatArgs.push(key, value);
        }
        return await this.redisClient.mset(...flatArgs);
      } else {
        return await this.memoryCache.mset(keyValues);
      }
    } catch (error) {
      logger.error('Cache mset operation failed', {
        provider: this.currentProvider,
        keyValues,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.mset(keyValues);
      }

      throw error;
    }
  }

  /**
   * Increment numeric value
   */
  async incr(key: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.incr(key);
      } else {
        return await this.memoryCache.incr(key);
      }
    } catch (error) {
      logger.error('Cache incr operation failed', {
        provider: this.currentProvider,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.incr(key);
      }

      throw error;
    }
  }

  /**
   * Increment numeric value by amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.incrby(key, increment);
      } else {
        return await this.memoryCache.incrby(key, increment);
      }
    } catch (error) {
      logger.error('Cache incrby operation failed', {
        provider: this.currentProvider,
        key,
        increment,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.incrby(key, increment);
      }

      throw error;
    }
  }

  /**
   * Decrement numeric value
   */
  async decr(key: string): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.decr(key);
      } else {
        return await this.memoryCache.decr(key);
      }
    } catch (error) {
      logger.error('Cache decr operation failed', {
        provider: this.currentProvider,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.decr(key);
      }

      throw error;
    }
  }

  /**
   * Decrement numeric value by amount
   */
  async decrby(key: string, decrement: number): Promise<number> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.decrby(key, decrement);
      } else {
        return await this.memoryCache.decrby(key, decrement);
      }
    } catch (error) {
      logger.error('Cache decrby operation failed', {
        provider: this.currentProvider,
        key,
        decrement,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.decrby(key, decrement);
      }

      throw error;
    }
  }

  /**
   * Clear all cache data
   */
  async flushall(): Promise<'OK'> {
    this.ensureInitialized();

    try {
      if (this.currentProvider === CacheProvider.REDIS && this.redisClient) {
        return await this.redisClient.flushall();
      } else {
        return await this.memoryCache.flushall();
      }
    } catch (error) {
      logger.error('Cache flushall operation failed', {
        provider: this.currentProvider,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.currentProvider === CacheProvider.REDIS) {
        await this.handleRedisFailure(error);
        return await this.memoryCache.flushall();
      }

      throw error;
    }
  }

  /**
   * Get current cache provider
   */
  getCurrentProvider(): CacheProvider {
    return this.currentProvider;
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get memory cache metrics
   */
  getMemoryCacheMetrics() {
    return this.memoryCache.getMetrics();
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): SyncStats {
    return { ...this.syncStats };
  }

  /**
   * Force switch to Redis (if available)
   */
  async switchToRedis(): Promise<boolean> {
    if (this.currentProvider === CacheProvider.REDIS) {
      return true;
    }

    try {
      await this.connectToRedis();

      if (this.config.enableDataSync) {
        await this.syncToRedis();
      }

      this.currentProvider = CacheProvider.REDIS;
      this.healthStatus.provider = CacheProvider.REDIS;
      this.healthStatus.isHealthy = true;
      this.healthStatus.consecutiveFailures = 0;

      logger.info('Switched to Redis provider');
      return true;
    } catch (error) {
      logger.error('Failed to switch to Redis', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Force switch to memory cache
   */
  switchToMemoryCache(): void {
    if (this.currentProvider === CacheProvider.MEMORY) {
      return;
    }

    this.currentProvider = CacheProvider.MEMORY;
    this.healthStatus.provider = CacheProvider.MEMORY;

    logger.info('Switched to memory cache provider');
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.failoverTimer) {
      clearTimeout(this.failoverTimer);
      this.failoverTimer = null;
    }

    if (this.redisClient) {
      try {
        await this.redisClient.disconnect();
      } catch (error) {
        logger.error('Error disconnecting Redis client', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.redisClient = null;
    }

    await this.memoryCache.disconnect();
    this.isInitialized = false;

    logger.info('CacheManager disconnected');
  }

  // Private methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('CacheManager not initialized. Call initialize() first.');
    }
  }

  private async connectToRedis(): Promise<void> {
    try {
      this.redisClient = await RedisConfigurationFactory.getRedisClient(
        this.config.redisInstanceName,
        this.config.redisEnvironment,
      );

      // Test connection
      await this.redisClient.ping();

      logger.info('Redis connection established');
    } catch (error) {
      this.redisClient = null;
      throw error;
    }
  }

  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Perform initial health check
    this.performHealthCheck();
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      if (this.redisClient) {
        await this.redisClient.ping();

        // Redis is healthy
        this.healthStatus.isHealthy = true;
        this.healthStatus.lastCheck = Date.now();
        this.healthStatus.consecutiveFailures = 0;
        this.healthStatus.responseTime = Date.now() - startTime;
        delete this.healthStatus.lastError;

        // If we're currently using memory cache, try to switch back to Redis
        if (this.currentProvider === CacheProvider.MEMORY) {
          await this.attemptRedisRecovery();
        }
      } else {
        // No Redis client, try to connect
        if (this.currentProvider === CacheProvider.REDIS) {
          await this.attemptRedisRecovery();
        }
      }
    } catch (error) {
      // Redis is unhealthy
      this.healthStatus.isHealthy = false;
      this.healthStatus.lastCheck = Date.now();
      this.healthStatus.consecutiveFailures++;
      this.healthStatus.lastError =
        error instanceof Error ? error.message : String(error);
      this.healthStatus.responseTime = Date.now() - startTime;

      logger.warn('Redis health check failed', {
        consecutiveFailures: this.healthStatus.consecutiveFailures,
        error: error instanceof Error ? error.message : String(error),
      });

      // Failover to memory cache if needed
      if (
        this.currentProvider === CacheProvider.REDIS &&
        this.healthStatus.consecutiveFailures >= 3
      ) {
        await this.handleRedisFailure(error);
      }
    }
  }

  private async handleRedisFailure(error: unknown): Promise<void> {
    logger.error('Redis failure detected, switching to memory cache', {
      error: error instanceof Error ? error.message : String(error),
      consecutiveFailures: this.healthStatus.consecutiveFailures,
    });

    this.currentProvider = CacheProvider.MEMORY;
    this.healthStatus.provider = CacheProvider.MEMORY;

    // Close Redis connection
    if (this.redisClient) {
      try {
        await this.redisClient.disconnect();
      } catch (disconnectError) {
        logger.error('Error disconnecting Redis during failover', {
          error:
            disconnectError instanceof Error
              ? disconnectError.message
              : String(disconnectError),
        });
      }
      this.redisClient = null;
    }

    logger.warn('Failed over to memory cache');
  }

  private async attemptRedisRecovery(): Promise<void> {
    if (this.syncStats.syncInProgress) {
      return; // Recovery already in progress
    }

    logger.info('Attempting Redis recovery');

    try {
      await this.connectToRedis();

      // Sync data from memory cache to Redis
      if (this.config.enableDataSync) {
        await this.syncToRedis();
      }

      // Switch back to Redis
      this.currentProvider = CacheProvider.REDIS;
      this.healthStatus.provider = CacheProvider.REDIS;
      this.healthStatus.isHealthy = true;
      this.healthStatus.consecutiveFailures = 0;

      logger.info('Redis recovery successful, switched back to Redis');
    } catch (error) {
      logger.error('Redis recovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async syncToRedis(): Promise<void> {
    if (!this.redisClient || this.syncStats.syncInProgress) {
      return;
    }

    this.syncStats.syncInProgress = true;

    try {
      const memoryKeys = this.memoryCache.keys();
      const criticalKeys = memoryKeys.filter(
        key =>
          this.config.criticalKeys.includes(key) ||
          key.startsWith('critical:') ||
          key.startsWith('session:') ||
          key.startsWith('auth:'),
      );

      logger.info('Syncing critical data to Redis', {
        totalKeys: memoryKeys.length,
        criticalKeys: criticalKeys.length,
      });

      let syncedCount = 0;
      for (let i = 0; i < criticalKeys.length; i += this.config.syncBatchSize) {
        const batch = criticalKeys.slice(i, i + this.config.syncBatchSize);

        for (const key of batch) {
          try {
            const value = await this.memoryCache.get(key);
            const ttl = await this.memoryCache.ttl(key);

            if (value) {
              if (ttl > 0) {
                await this.redisClient.set(key, value, 'EX', ttl);
              } else {
                await this.redisClient.set(key, value);
              }
              syncedCount++;
            }
          } catch (error) {
            this.syncStats.syncErrors++;
            logger.error('Error syncing key to Redis', {
              key,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.syncStats.totalSynced += syncedCount;
      this.syncStats.lastSyncTime = Date.now();

      logger.info('Data sync to Redis completed', {
        syncedCount,
        errors: this.syncStats.syncErrors,
      });
    } catch (error) {
      this.syncStats.syncErrors++;
      logger.error('Error during Redis sync', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.syncStats.syncInProgress = false;
    }
  }
}

export default CacheManager;
