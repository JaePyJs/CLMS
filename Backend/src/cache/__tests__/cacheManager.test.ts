import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CacheManager, CacheProvider } from '../cacheManager';
import { InMemoryCache, EvictionPolicy } from '../memoryCache';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockRedis = Redis as jest.MockedClass<typeof Redis>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockRedisClient: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock Redis client
    mockRedisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hdel: jest.fn(),
      hexists: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      incr: jest.fn(),
      incrby: jest.fn(),
      decr: jest.fn(),
      decrby: jest.fn(),
      flushall: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockRedis.mockImplementation(() => mockRedisClient as any);
  });

  afterEach(async () => {
    if (cacheManager) {
      await cacheManager.disconnect();
    }
  });

  describe('Initialization', () => {
    it('should initialize with Redis successfully', async () => {
      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 1000
      });

      await cacheManager.initialize();

      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.REDIS);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should fallback to memory cache when Redis fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));

      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 1000
      });

      await cacheManager.initialize();

      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.MEMORY);
    });
  });

  describe('Cache Operations', () => {
    beforeEach(async () => {
      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 1000
      });
      await cacheManager.initialize();
    });

    it('should get value from Redis when available', async () => {
      mockRedisClient.get.mockResolvedValue('test-value');
      
      const result = await cacheManager.get('test-key');
      
      expect(result).toBe('test-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should set value in Redis when available', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      
      const result = await cacheManager.set('test-key', 'test-value');
      
      expect(result).toBe('OK');
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set value with TTL in Redis when available', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      
      const result = await cacheManager.set('test-key', 'test-value', 60000);
      
      expect(result).toBe('OK');
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 60);
    });

    it('should delete key from Redis when available', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      
      const result = await cacheManager.del('test-key');
      
      expect(result).toBe(1);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should check if key exists in Redis when available', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      
      const result = await cacheManager.exists('test-key');
      
      expect(result).toBe(1);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
    });

    it('should handle hash operations in Redis when available', async () => {
      mockRedisClient.hget.mockResolvedValue('field-value');
      mockRedisClient.hset.mockResolvedValue(1);
      mockRedisClient.hdel.mockResolvedValue(1);
      mockRedisClient.hexists.mockResolvedValue(1);

      const get_result = await cacheManager.hget('hash-key', 'field');
      const set_result = await cacheManager.hset('hash-key', 'field', 'field-value');
      const del_result = await cacheManager.hdel('hash-key', 'field');
      const exists_result = await cacheManager.hexists('hash-key', 'field');

      expect(get_result).toBe('field-value');
      expect(set_result).toBe(1);
      expect(del_result).toBe(1);
      expect(exists_result).toBe(1);

      expect(mockRedisClient.hget).toHaveBeenCalledWith('hash-key', 'field');
      expect(mockRedisClient.hset).toHaveBeenCalledWith('hash-key', 'field', 'field-value');
      expect(mockRedisClient.hdel).toHaveBeenCalledWith('hash-key', 'field');
      expect(mockRedisClient.hexists).toHaveBeenCalledWith('hash-key', 'field');
    });

    it('should handle increment/decrement operations in Redis when available', async () => {
      mockRedisClient.incr.mockResolvedValue(2);
      mockRedisClient.incrby.mockResolvedValue(5);
      mockRedisClient.decr.mockResolvedValue(1);
      mockRedisClient.decrby.mockResolvedValue(0);

      const incr_result = await cacheManager.incr('counter');
      const incrby_result = await cacheManager.incrby('counter', 3);
      const decr_result = await cacheManager.decr('counter');
      const decrby_result = await cacheManager.decrby('counter', 1);

      expect(incr_result).toBe(2);
      expect(incrby_result).toBe(5);
      expect(decr_result).toBe(1);
      expect(decrby_result).toBe(0);

      expect(mockRedisClient.incr).toHaveBeenCalledWith('counter');
      expect(mockRedisClient.incrby).toHaveBeenCalledWith('counter', 3);
      expect(mockRedisClient.decr).toHaveBeenCalledWith('counter');
      expect(mockRedisClient.decrby).toHaveBeenCalledWith('counter', 1);
    });
  });

  describe('Failover Behavior', () => {
    beforeEach(async () => {
      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 100,
        failoverTimeout: 100
      });
      await cacheManager.initialize();
    });

    it('should fallback to memory cache when Redis operation fails', async () => {
      // Start with Redis
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.REDIS);

      // Make Redis operations fail
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection lost'));

      const result = await cacheManager.get('test-key');

      // Should fallback to memory cache
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.MEMORY);
      expect(result).toBeNull(); // Memory cache returns null for non-existent key
    });

    it('should recover to Redis when it becomes available again', async () => {
      // Start with Redis
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.REDIS);

      // Make Redis operations fail to trigger failover
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection lost'));
      await cacheManager.get('test-key');

      // Should be in memory cache now
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.MEMORY);

      // Make Redis operations succeed again
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.get.mockResolvedValue('test-value');

      // Wait for health check to detect recovery
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should recover to Redis
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.REDIS);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 100
      });
      await cacheManager.initialize();
    });

    it('should track health status correctly', async () => {
      const healthStatus = cacheManager.getHealthStatus();
      
      expect(healthStatus.provider).toBe(CacheProvider.REDIS);
      expect(healthStatus.isHealthy).toBe(true);
      expect(healthStatus.consecutiveFailures).toBe(0);
    });

    it('should detect Redis unavailability', async () => {
      // Make Redis fail
      mockRedisClient.ping.mockRejectedValue(new Error('Redis down'));

      // Wait for health check to detect failure
      await new Promise(resolve => setTimeout(resolve, 200));

      const healthStatus = cacheManager.getHealthStatus();
      expect(healthStatus.isHealthy).toBe(false);
      expect(healthStatus.consecutiveFailures).toBeGreaterThan(0);
    });
  });

  describe('Memory Cache Integration', () => {
    it('should use memory cache when Redis is not available', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));

      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 1000
      });

      await cacheManager.initialize();

      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.MEMORY);

      // Test memory cache operations
      await cacheManager.set('memory-key', 'memory-value');
      const result = await cacheManager.get('memory-key');

      expect(result).toBe('memory-value');
    });

    it('should get memory cache metrics', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));

      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 1000
      });

      await cacheManager.initialize();

      const metrics = cacheManager.getMemoryCacheMetrics();
      
      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('sets');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('itemCount');
    });
  });

  describe('Provider Switching', () => {
    beforeEach(async () => {
      cacheManager = new CacheManager({
        redisInstanceName: 'test',
        healthCheckInterval: 1000
      });
      await cacheManager.initialize();
    });

    it('should force switch to memory cache', async () => {
      cacheManager.switchToMemoryCache();
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.MEMORY);
    });

    it('should force switch to Redis when available', async () => {
      // First switch to memory cache
      cacheManager.switchToMemoryCache();
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.MEMORY);

      // Then switch back to Redis
      const result = await cacheManager.switchToRedis();
      expect(result).toBe(true);
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.REDIS);
    });

    it('should fail to switch to Redis when not available', async () => {
      // First switch to memory cache
      cacheManager.switchToMemoryCache();
      
      // Make Redis unavailable
      mockRedisClient.ping.mockRejectedValue(new Error('Redis down'));

      // Try to switch back to Redis
      const result = await cacheManager.switchToRedis();
      expect(result).toBe(false);
      expect(cacheManager.getCurrentProvider()).toBe(CacheProvider.MEMORY);
    });
  });
});

describe('InMemoryCache', () => {
  let memoryCache: InMemoryCache;

  beforeEach(() => {
    memoryCache = new InMemoryCache({
      maxSize: 10,
      evictionPolicy: EvictionPolicy.LRU,
      defaultTTL: 60000,
      cleanupInterval: 1000,
      enableMetrics: true
    });
  });

  afterEach(async () => {
    await memoryCache.disconnect();
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      await memoryCache.set('key1', 'value1');
      const result = await memoryCache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const result = await memoryCache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      await memoryCache.set('key1', 'value1');
      const delResult = await memoryCache.del('key1');
      const getResult = await memoryCache.get('key1');
      
      expect(delResult).toBe(1);
      expect(getResult).toBeNull();
    });

    it('should check if key exists', async () => {
      await memoryCache.set('key1', 'value1');
      const existsResult = await memoryCache.exists('key1');
      const notExistsResult = await memoryCache.exists('non-existent');
      
      expect(existsResult).toBe(1);
      expect(notExistsResult).toBe(0);
    });
  });

  describe('TTL Support', () => {
    it('should set TTL for keys', async () => {
      await memoryCache.set('key1', 'value1', 1000); // 1 second TTL
      const ttlResult = await memoryCache.ttl('key1');
      expect(ttlResult).toBeGreaterThan(0);
      expect(ttlResult).toBeLessThanOrEqual(1);
    });

    it('should expire keys after TTL', async () => {
      await memoryCache.set('key1', 'value1', 50); // 50ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await memoryCache.get('key1');
      expect(result).toBeNull();
    });

    it('should update TTL for existing keys', async () => {
      await memoryCache.set('key1', 'value1');
      const expireResult = await memoryCache.expire('key1', 2000);
      const ttlResult = await memoryCache.ttl('key1');
      
      expect(expireResult).toBe(1);
      expect(ttlResult).toBeGreaterThan(0);
      expect(ttlResult).toBeLessThanOrEqual(2);
    });
  });

  describe('Hash Operations', () => {
    it('should handle hash operations', async () => {
      const hsetResult = await memoryCache.hset('hash1', 'field1', 'value1');
      const hgetResult = await memoryCache.hget('hash1', 'field1');
      const hexistsResult = await memoryCache.hexists('hash1', 'field1');
      const hdelResult = await memoryCache.hdel('hash1', 'field1');
      const notExistsResult = await memoryCache.hexists('hash1', 'field1');
      
      expect(hsetResult).toBe(1);
      expect(hgetResult).toBe('value1');
      expect(hexistsResult).toBe(1);
      expect(hdelResult).toBe(1);
      expect(notExistsResult).toBe(0);
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple get operations', async () => {
      await memoryCache.set('key1', 'value1');
      await memoryCache.set('key2', 'value2');
      await memoryCache.set('key3', 'value3');
      
      const results = await memoryCache.mget('key1', 'key2', 'key3', 'non-existent');
      expect(results).toEqual(['value1', 'value2', 'value3', null]);
    });

    it('should handle multiple set operations', async () => {
      const result = await memoryCache.mset([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3']
      ]);
      
      expect(result).toBe('OK');
      
      const value1 = await memoryCache.get('key1');
      const value2 = await memoryCache.get('key2');
      const value3 = await memoryCache.get('key3');
      
      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(value3).toBe('value3');
    });
  });

  describe('Increment/Decrement Operations', () => {
    it('should increment and decrement values', async () => {
      const incrResult = await memoryCache.incr('counter');
      const incrbyResult = await memoryCache.incrby('counter', 5);
      const decrResult = await memoryCache.decr('counter');
      const decrbyResult = await memoryCache.decrby('counter', 2);
      
      expect(incrResult).toBe(1);
      expect(incrbyResult).toBe(6);
      expect(decrResult).toBe(5);
      expect(decrbyResult).toBe(3);
    });
  });

  describe('Eviction Policies', () => {
    it('should evict items when max size is reached', async () => {
      // Fill cache to max capacity
      for (let i = 0; i < 10; i++) {
        await memoryCache.set(`key${i}`, `value${i}`);
      }
      
      // Add one more item to trigger eviction
      await memoryCache.set('key10', 'value10');
      
      // Cache should still be at or below max size
      expect(memoryCache.size()).toBeLessThanOrEqual(10);
      
      // Some items should have been evicted
      const metrics = memoryCache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
    });
  });

  describe('Metrics', () => {
    it('should track operations correctly', async () => {
      await memoryCache.set('key1', 'value1');
      await memoryCache.get('key1');
      await memoryCache.get('non-existent');
      await memoryCache.del('key1');
      
      const metrics = memoryCache.getMetrics();
      
      expect(metrics.sets).toBe(1);
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.deletes).toBe(1);
      expect(metrics.totalOperations).toBe(4);
    });

    it('should reset metrics', async () => {
      await memoryCache.set('key1', 'value1');
      
      let metrics = memoryCache.getMetrics();
      expect(metrics.sets).toBe(1);
      
      memoryCache.resetMetrics();
      
      metrics = memoryCache.getMetrics();
      expect(metrics.sets).toBe(0);
    });
  });
});