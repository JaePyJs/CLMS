import Redis from 'ioredis';
import { logger } from './logger';
import {
  RedisConfigurationFactory,
  getRedisClient as getConfiguredRedisClient,
  disconnectRedis as disconnectConfiguredRedis,
  getRedisConnectionStatus,
  performRedisHealthCheck
} from '../config/redis.config';
import { CacheManager, CacheManagerConfig, CacheProvider } from '../cache/cacheManager';

// Redis client singleton for backward compatibility
let redisClient: Redis | null = null;
let cacheManager: CacheManager | null = null;

/**
 * Get or create cache manager with fallback support
 */
export const getCacheManager = async (config?: CacheManagerConfig): Promise<CacheManager> => {
  if (!cacheManager) {
    cacheManager = new CacheManager(config);
    await cacheManager.initialize();
    logger.info('Cache manager initialized with fallback support');
  }
  return cacheManager;
};

/**
 * @deprecated Use getRedisClient from redis.config.ts instead
 * Get Redis client with basic configuration (for backward compatibility)
 */
export const getRedisClient = async (): Promise<Redis> => {
  if (!redisClient) {
    try {
      redisClient = await getConfiguredRedisClient('legacy');
      logger.info('Redis client initialized using configuration factory');
    } catch (error) {
      logger.error('Failed to initialize Redis client using configuration factory, falling back to basic configuration', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to basic configuration
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      redisClient.on('connect', () => {
        logger.info('Redis client connected (fallback configuration)');
      });

      redisClient.on('error', (error) => {
        logger.error('Redis client error', { error: error.message });
      });

      redisClient.on('close', () => {
        logger.warn('Redis client connection closed');
      });
    }
  }

  return redisClient;
};

/**
 * @deprecated Use disconnectRedis from redis.config.ts instead
 * Disconnect Redis client (for backward compatibility)
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      if (redisClient.status === 'ready') {
        await redisClient.disconnect();
      }
      redisClient = null;
      logger.info('Redis client disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis client', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Disconnect cache manager if it exists
  if (cacheManager) {
    try {
      await cacheManager.disconnect();
      cacheManager = null;
      logger.info('Cache manager disconnected');
    } catch (error) {
      logger.error('Error disconnecting cache manager', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Also disconnect all configured instances
  try {
    await disconnectConfiguredRedis('legacy');
    await RedisConfigurationFactory.disconnectAll();
  } catch (error) {
    logger.error('Error disconnecting configured Redis instances', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get Redis connection status
 */
export const getConnectionStatus = (): string => {
  return getRedisConnectionStatus('legacy');
};

/**
 * Perform health check on Redis connection
 */
export const healthCheck = async (): Promise<boolean> => {
  try {
    const healthResults = await performRedisHealthCheck();
    return healthResults['legacy_development'] || healthResults['legacy_testing'] ||
           healthResults['legacy_staging'] || healthResults['legacy_production'] || false;
  } catch (error) {
    logger.error('Redis health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

/**
 * Get Redis client with specific configuration
 */
export const getConfiguredClient = async (instanceName: string = 'default', environment?: string): Promise<Redis> => {
  return getConfiguredRedisClient(instanceName);
};

/**
 * Get cache manager with specific configuration
 */
export const getConfiguredCacheManager = async (config?: CacheManagerConfig): Promise<CacheManager> => {
  return getCacheManager(config);
};

/**
 * Get current cache provider
 */
export const getCurrentCacheProvider = async (): Promise<CacheProvider> => {
  const manager = await getCacheManager();
  return manager.getCurrentProvider();
};

/**
 * Get cache health status
 */
export const getCacheHealthStatus = async () => {
  const manager = await getCacheManager();
  return manager.getHealthStatus();
};

/**
 * Get memory cache metrics
 */
export const getMemoryCacheMetrics = async () => {
  const manager = await getCacheManager();
  return manager.getMemoryCacheMetrics();
};

/**
 * Force switch to Redis (if available)
 */
export const switchToRedis = async (): Promise<boolean> => {
  const manager = await getCacheManager();
  return manager.switchToRedis();
};

/**
 * Force switch to memory cache
 */
export const switchToMemoryCache = async (): Promise<void> => {
  const manager = await getCacheManager();
  manager.switchToMemoryCache();
};

/**
 * Graceful Redis operations with fallback to cache manager
 */
export const safeRedisOperation = async <T>(
  operation: (client: Redis) => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    const client = await getRedisClient();
    return await operation(client);
  } catch (error) {
    logger.error('Redis operation failed, using cache manager fallback', {
      error: error instanceof Error ? error.message : String(error),
      operation: operation.name
    });
    
    // Try to use cache manager as fallback
    try {
      const manager = await getCacheManager();
      // For basic operations, we can't directly translate to cache manager
      // So we return the fallback value
      logger.info('Using fallback value due to Redis unavailability');
      return fallbackValue;
    } catch (cacheError) {
      logger.error('Cache manager also failed', {
        error: cacheError instanceof Error ? cacheError.message : String(cacheError)
      });
      return fallbackValue;
    }
  }
};

/**
 * Enhanced cache operations with automatic fallback
 */
export const cacheOperation = async <T>(
  operation: (manager: CacheManager) => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    const manager = await getCacheManager();
    return await operation(manager);
  } catch (error) {
    logger.error('Cache operation failed', {
      error: error instanceof Error ? error.message : String(error),
      operation: operation.name
    });
    return fallbackValue;
  }
};

// Export a default instance for backward compatibility (async)
export default async (): Promise<Redis> => {
  return getRedisClient();
};

// Export the configuration factory for direct access
export { RedisConfigurationFactory };

// Export cache manager for direct access
export { CacheManager };
export type { CacheManagerConfig, CacheProvider };