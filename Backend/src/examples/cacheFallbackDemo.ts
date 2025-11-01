import { CacheManager, CacheProvider } from '../cache/cacheManager';
import { logger } from '../utils/logger';

/**
 * Demonstration script for cache fallback functionality
 * Shows how the CacheManager automatically switches between Redis and in-memory cache
 */
async function demonstrateCacheFallback(): Promise<void> {
  logger.info('=== Cache Fallback Demonstration ===');
  
  // Create cache manager with custom configuration
  const cacheManager = new CacheManager({
    redisInstanceName: 'demo',
    memoryCacheConfig: {
      maxSize: 100,
      evictionPolicy: 'lru' as any,
      defaultTTL: 300000, // 5 minutes
      cleanupInterval: 30000, // 30 seconds
      enableMetrics: true,
      persistCriticalData: true,
      persistKeyPrefix: 'critical:'
    },
    healthCheckInterval: 5000, // 5 seconds
    failoverTimeout: 3000, // 3 seconds
    enableDataSync: true,
    criticalKeys: ['user:session:123', 'config:app']
  });

  try {
    // Initialize the cache manager
    logger.info('Initializing cache manager...');
    await cacheManager.initialize();
    
    logger.info('Initial cache provider:', cacheManager.getCurrentProvider());
    logger.info('Initial health status:', cacheManager.getHealthStatus());

    // Demonstrate basic cache operations
    logger.info('\n--- Basic Cache Operations ---');
    
    // Set some values
    await cacheManager.set('demo:key1', 'value1', 60000);
    await cacheManager.set('demo:key2', { name: 'John', age: 30 }, 60000);
    await cacheManager.set('critical:user:session:123', 'session-data-123', 300000);
    
    // Get values
    const value1 = await cacheManager.get('demo:key1');
    const value2 = await cacheManager.get('demo:key2');
    const session = await cacheManager.get('critical:user:session:123');
    
    logger.info('Retrieved value1:', value1);
    logger.info('Retrieved value2:', value2);
    logger.info('Retrieved session:', session);

    // Demonstrate hash operations
    logger.info('\n--- Hash Operations ---');
    
    await cacheManager.hset('demo:hash1', 'field1', 'hash-value1');
    await cacheManager.hset('demo:hash1', 'field2', 'hash-value2');
    
    const hashValue1 = await cacheManager.hget('demo:hash1', 'field1');
    const hashValue2 = await cacheManager.hget('demo:hash1', 'field2');
    
    logger.info('Hash field1:', hashValue1);
    logger.info('Hash field2:', hashValue2);

    // Demonstrate increment/decrement
    logger.info('\n--- Increment/Decrement Operations ---');
    
    let counter = await cacheManager.incr('demo:counter');
    logger.info('Counter after incr:', counter);
    
    counter = await cacheManager.incrby('demo:counter', 5);
    logger.info('Counter after incrby 5:', counter);
    
    counter = await cacheManager.decr('demo:counter');
    logger.info('Counter after decr:', counter);

    // Show current metrics
    logger.info('\n--- Memory Cache Metrics ---');
    const metrics = cacheManager.getMemoryCacheMetrics();
    logger.info('Memory cache metrics:', metrics);

    // Show health status
    logger.info('\n--- Health Status ---');
    const healthStatus = cacheManager.getHealthStatus();
    logger.info('Health status:', healthStatus);

    // Simulate Redis failure (if currently using Redis)
    if (cacheManager.getCurrentProvider() === CacheProvider.REDIS) {
      logger.info('\n--- Simulating Redis Failure ---');
      
      // Force switch to memory cache
      cacheManager.switchToMemoryCache();
      logger.info('Switched to memory cache provider');
      
      // Continue operations with memory cache
      await cacheManager.set('demo:fallback:test', 'fallback-value', 60000);
      const fallbackValue = await cacheManager.get('demo:fallback:test');
      logger.info('Fallback operation result:', fallbackValue);
      
      // Show metrics after failover
      const fallbackMetrics = cacheManager.getMemoryCacheMetrics();
      logger.info('Metrics after failover:', fallbackMetrics);
    }

    // Try to recover Redis connection
    logger.info('\n--- Attempting Redis Recovery ---');
    const recoverySuccess = await cacheManager.switchToRedis();
    logger.info('Redis recovery success:', recoverySuccess);
    logger.info('Current provider:', cacheManager.getCurrentProvider());

    // Show sync statistics
    logger.info('\n--- Sync Statistics ---');
    const syncStats = cacheManager.getSyncStats();
    logger.info('Sync statistics:', syncStats);

    // Demonstrate batch operations
    logger.info('\n--- Batch Operations ---');
    
    const batchResults = await cacheManager.mget('demo:key1', 'demo:key2', 'demo:counter');
    logger.info('Batch get results:', batchResults);
    
    await cacheManager.mset([
      ['batch:key1', 'batch-value1'],
      ['batch:key2', 'batch-value2'],
      ['batch:key3', 'batch-value3']
    ]);
    
    const batchGetResults = await cacheManager.mget('batch:key1', 'batch:key2', 'batch:key3');
    logger.info('Batch set and get results:', batchGetResults);

    // Final metrics
    logger.info('\n--- Final Metrics ---');
    const finalMetrics = cacheManager.getMemoryCacheMetrics();
    logger.info('Final memory cache metrics:', finalMetrics);
    
    const finalHealthStatus = cacheManager.getHealthStatus();
    logger.info('Final health status:', finalHealthStatus);

  } catch (error) {
    logger.error('Error during demonstration:', error);
  } finally {
    // Cleanup
    logger.info('\n--- Cleanup ---');
    await cacheManager.disconnect();
    logger.info('Cache manager disconnected');
  }
}

/**
 * Demonstrate performance comparison between Redis and memory cache
 */
async function demonstratePerformanceComparison(): Promise<void> {
  logger.info('\n=== Performance Comparison ===');
  
  const cacheManager = new CacheManager({
    redisInstanceName: 'perf-test',
    healthCheckInterval: 10000
  });

  try {
    await cacheManager.initialize();
    
    const testKeys = Array.from({ length: 1000 }, (_, i) => `perf:key:${i}`);
    const testValues = Array.from({ length: 1000 }, (_, i) => `perf:value:${i}`);
    
    // Test performance with current provider
    logger.info(`Testing performance with ${cacheManager.getCurrentProvider()}...`);
    
    const setStartTime = Date.now();
    for (let i = 0; i < testKeys.length; i++) {
      await cacheManager.set(testKeys[i] || '', testValues[i] || '', 60000);
    }
    const setEndTime = Date.now();
    
    const getStartTime = Date.now();
    for (const key of testKeys) {
      await cacheManager.get(key);
    }
    const getEndTime = Date.now();
    
    logger.info(`Set operations: ${testKeys.length} in ${setEndTime - setStartTime}ms`);
    logger.info(`Get operations: ${testKeys.length} in ${getEndTime - getStartTime}ms`);
    logger.info(`Average set time: ${(setEndTime - setStartTime) / testKeys.length}ms`);
    logger.info(`Average get time: ${(getEndTime - getStartTime) / testKeys.length}ms`);
    
    // Show metrics
    const metrics = cacheManager.getMemoryCacheMetrics();
    logger.info('Performance metrics:', metrics);
    
  } catch (error) {
    logger.error('Error during performance test:', error);
  } finally {
    await cacheManager.disconnect();
  }
}

// Run demonstrations if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await demonstrateCacheFallback();
      await demonstratePerformanceComparison();
    } catch (error) {
      logger.error('Demo failed:', error);
      process.exit(1);
    }
  })();
}

export { demonstrateCacheFallback, demonstratePerformanceComparison };