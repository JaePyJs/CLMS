/**
 * Enhanced Redis Configuration with Clustering Support
 *
 * This module provides optimized Redis configuration with clustering,
 * connection pooling, and advanced caching strategies for production.
 */

import Redis from 'ioredis';
import { logger } from '@/utils/logger';

interface RedisConfig {
  // Connection settings
  host: string;
  port: number;
  password?: string;
  db: number;

  // Cluster settings
  enableCluster: boolean;
  clusterNodes: Array<{ host: string; port: number }>;
  clusterOptions: {
    enableReadyCheck: boolean;
    redisOptions: {
      maxRetriesPerRequest: number;
      retryDelayOnFailover: number;
      enableOfflineQueue: boolean;
      lazyConnect: boolean;
    };
  };

  // Performance settings
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
  keepAlive: number;
  family: number;

  // Pool settings
  connectionPoolSize: number;
  connectionTimeout: number;
  commandTimeout: number;

  // Caching settings
  defaultTTL: number;
  maxMemoryPolicy: string;
  sampleSize: number;
}

class EnhancedRedisManager {
  private redis: Redis | Redis.Cluster;
  private config: RedisConfig;
  private subscriber: Redis;
  private publisher: Redis;
  private cacheStats: Map<string, { hits: number; misses: number; sets: number }> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.redis = this.createRedisInstance();
    this.subscriber = this.createRedisInstance();
    this.publisher = this.createRedisInstance();
    this.setupEventListeners();
  }

  private loadConfig(): RedisConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const enableCluster = process.env.REDIS_ENABLE_CLUSTER === 'true';

    const baseConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),

      // Performance settings
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      enableOfflineQueue: !isProduction, // Disable in production
      lazyConnect: true,
      keepAlive: 30000,
      family: 4, // IPv4

      // Pool settings
      connectionPoolSize: parseInt(process.env.REDIS_POOL_SIZE || (isProduction ? '10' : '5')),
      connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),

      // Caching settings
      defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '3600'), // 1 hour
      maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
      sampleSize: parseInt(process.env.REDIS_SAMPLE_SIZE || '5'),
    };

    if (enableCluster) {
      const clusterNodes = this.parseClusterNodes();

      return {
        ...baseConfig,
        enableCluster: true,
        clusterNodes,
        clusterOptions: {
          enableReadyCheck: true,
          redisOptions: {
            maxRetriesPerRequest: baseConfig.maxRetriesPerRequest,
            retryDelayOnFailover: baseConfig.retryDelayOnFailover,
            enableOfflineQueue: baseConfig.enableOfflineQueue,
            lazyConnect: baseConfig.lazyConnect,
          },
        },
      };
    }

    return {
      ...baseConfig,
      enableCluster: false,
      clusterNodes: [],
      clusterOptions: {
        enableReadyCheck: true,
        redisOptions: {
          maxRetriesPerRequest: baseConfig.maxRetriesPerRequest,
          retryDelayOnFailover: baseConfig.retryDelayOnFailover,
          enableOfflineQueue: baseConfig.enableOfflineQueue,
          lazyConnect: baseConfig.lazyConnect,
        },
      },
    };
  }

  private parseClusterNodes(): Array<{ host: string; port: number }> {
    const nodesString = process.env.REDIS_CLUSTER_NODES || '';
    if (!nodesString) {
      return [
        { host: this.config.host, port: this.config.port },
      ];
    }

    return nodesString.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) };
    });
  }

  private createRedisInstance(): Redis | Redis.Cluster {
    if (this.config.enableCluster && this.config.clusterNodes.length > 1) {
      logger.info('Initializing Redis cluster', {
        nodes: this.config.clusterNodes,
      });

      return new Redis.Cluster(this.config.clusterNodes, this.config.clusterOptions);
    }

    logger.info('Initializing single Redis instance', {
      host: this.config.host,
      port: this.config.port,
      db: this.config.db,
    });

    return new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      retryDelayOnFailover: this.config.retryDelayOnFailover,
      enableOfflineQueue: this.config.enableOfflineQueue,
      lazyConnect: this.config.lazyConnect,
      keepAlive: this.config.keepAlive,
      family: this.config.family,
      connectTimeout: this.config.connectionTimeout,
      commandTimeout: this.config.commandTimeout,
    });
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready for commands');
      this.configureRedisSettings();
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', {
        error: error.message,
      });
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', (delay) => {
      logger.info('Redis reconnecting', { delay });
    });

    // Setup subscriber events
    this.subscriber.on('message', (channel, message) => {
      this.handleSubscriptionMessage(channel, message);
    });
  }

  private async configureRedisSettings(): Promise<void> {
    try {
      // Configure memory policy
      await this.redis.config('SET', 'maxmemory-policy', this.config.maxMemoryPolicy);

      // Configure slow log
      await this.redis.config('SET', 'slowlog-log-slower-than', '10000'); // 10ms
      await this.redis.config('SET', 'slowlog-max-len', '128');

      logger.info('Redis settings configured successfully', {
        maxMemoryPolicy: this.config.maxMemoryPolicy,
        slowLogThreshold: '10ms',
      });
    } catch (error) {
      logger.warn('Failed to configure Redis settings', {
        error: (error as Error).message,
      });
    }
  }

  private handleSubscriptionMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case 'cache:invalidate':
          this.handleCacheInvalidation(data);
          break;
        case 'cache:clear':
          this.handleCacheClear(data);
          break;
        default:
          logger.debug('Unknown subscription message', { channel, data });
      }
    } catch (error) {
      logger.error('Error handling subscription message', {
        channel,
        message,
        error: (error as Error).message,
      });
    }
  }

  private async handleCacheInvalidation(data: { pattern: string }): Promise<void> {
    try {
      const keys = await this.redis.keys(data.pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug('Cache invalidated', { pattern: data.pattern, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error('Failed to invalidate cache', {
        pattern: data.pattern,
        error: (error as Error).message,
      });
    }
  }

  private async handleCacheClear(data: { scope?: string }): Promise<void> {
    try {
      const pattern = data.scope ? `${data.scope}:*` : '*';
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Cache cleared', { pattern, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error('Failed to clear cache', {
        pattern: data.pattern,
        error: (error as Error).message,
      });
    }
  }

  // Enhanced caching methods
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (value) {
        this.updateStats(key, 'hit');
        return JSON.parse(value) as T;
      } else {
        this.updateStats(key, 'miss');
        return null;
      }
    } catch (error) {
      logger.error('Redis get error', {
        key,
        error: (error as Error).message,
      });
      this.updateStats(key, 'miss');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      const expiration = ttl || this.config.defaultTTL;

      if (expiration > 0) {
        await this.redis.setex(key, expiration, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }

      this.updateStats(key, 'set');
    } catch (error) {
      logger.error('Redis set error', {
        key,
        error: (error as Error).message,
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.debug('Redis key deleted', { key });
    } catch (error) {
      logger.error('Redis delete error', {
        key,
        error: (error as Error).message,
      });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', {
        key,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      logger.error('Redis incr error', {
        key,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      logger.error('Redis expire error', {
        key,
        ttl,
        error: (error as Error).message,
      });
    }
  }

  // Advanced caching patterns
  async getWithFallback<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute fallback function
    const result = await fallback();

    // Cache the result
    await this.set(key, result, ttl);

    return result;
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    try {
      const values = await this.redis.mget(...keys);
      const result = new Map<string, T | null>();

      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          result.set(key, JSON.parse(value) as T);
          this.updateStats(key, 'hit');
        } else {
          result.set(key, null);
          this.updateStats(key, 'miss');
        }
      });

      return result;
    } catch (error) {
      logger.error('Redis mget error', {
        keys,
        error: (error as Error).message,
      });

      // Return empty map on error
      return new Map(keys.map(key => [key, null]));
    }
  }

  async setMultiple<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const expiration = ttl || this.config.defaultTTL;

      entries.forEach((value, key) => {
        const serializedValue = JSON.stringify(value);
        if (expiration > 0) {
          pipeline.setex(key, expiration, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
        this.updateStats(key, 'set');
      });

      await pipeline.exec();
    } catch (error) {
      logger.error('Redis mset error', {
        entries: entries.size,
        error: (error as Error).message,
      });
    }
  }

  // Pub/Sub methods
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      logger.debug('Subscribed to Redis channel', { channel });
    } catch (error) {
      logger.error('Redis subscribe error', {
        channel,
        error: (error as Error).message,
      });
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    try {
      const serializedMessage = JSON.stringify(message);
      await this.publisher.publish(channel, serializedMessage);
      logger.debug('Published to Redis channel', { channel });
    } catch (error) {
      logger.error('Redis publish error', {
        channel,
        error: (error as Error).message,
      });
    }
  }

  // Health check and monitoring
  async healthCheck(): Promise<{
    connected: boolean;
    responseTime?: number;
    error?: string;
    info?: any;
    stats?: any;
  }> {
    try {
      const startTime = Date.now();

      // Test basic connectivity
      await this.redis.ping();

      const responseTime = Date.now() - startTime;

      // Get Redis info
      const info = await this.redis.info();

      return {
        connected: true,
        responseTime,
        info: this.parseRedisInfo(info),
        stats: this.getCacheStats(),
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const parsed: any = {};

    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          parsed[key] = value;
        }
      }
    });

    return {
      version: parsed.redis_version,
      uptime: parsed.uptime_in_seconds,
      connectedClients: parsed.connected_clients,
      usedMemory: parsed.used_memory_human,
      totalCommandsProcessed: parsed.total_commands_processed,
      keyspaceHits: parsed.keyspace_hits,
      keyspaceMisses: parsed.keyspace_misses,
      hitRate: parsed.keyspace_hits && parsed.keyspace_misses
        ? ((parseInt(parsed.keyspace_hits) / (parseInt(parsed.keyspace_hits) + parseInt(parsed.keyspace_misses))) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  private updateStats(key: string, operation: 'hit' | 'miss' | 'set'): void {
    const prefix = key.split(':')[0];
    const stats = this.cacheStats.get(prefix) || { hits: 0, misses: 0, sets: 0 };

    switch (operation) {
      case 'hit':
        stats.hits++;
        break;
      case 'miss':
        stats.misses++;
        break;
      case 'set':
        stats.sets++;
        break;
    }

    this.cacheStats.set(prefix, stats);
  }

  private getCacheStats(): any {
    const totalStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      hitRate: 0,
    };

    this.cacheStats.forEach(stats => {
      totalStats.hits += stats.hits;
      totalStats.misses += stats.misses;
      totalStats.sets += stats.sets;
    });

    const totalRequests = totalStats.hits + totalStats.misses;
    totalStats.hitRate = totalRequests > 0
      ? ((totalStats.hits / totalRequests) * 100).toFixed(2) + '%'
      : '0%';

    return {
      ...totalStats,
      byPrefix: Object.fromEntries(this.cacheStats),
      totalKeys: this.cacheStats.size,
    };
  }

  async clearCache(pattern?: string): Promise<void> {
    try {
      const keyPattern = pattern || '*';
      const keys = await this.redis.keys(keyPattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Cache cleared', { pattern: keyPattern, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error('Failed to clear cache', {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.quit(),
        this.subscriber.quit(),
        this.publisher.quit(),
      ]);
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from Redis', {
        error: (error as Error).message,
      });
    }
  }

  getClient(): Redis | Redis.Cluster {
    return this.redis;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  getPublisher(): Redis {
    return this.publisher;
  }
}

// Create and export singleton instance
export const enhancedRedis = new EnhancedRedisManager();
export default enhancedRedis;