import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { measureExecutionTime, runLoadTest } from '../helpers/testUtils';
import { cacheManager } from '@/utils/caching';
import { CacheManager } from '@/cache/cacheManager';

describe('Cache Performance Tests', () => {
  let advancedCacheManager: CacheManager;
  let testKeys: string[] = [];
  let testData: any[] = [];

  beforeAll(async () => {
    // Initialize advanced cache manager
    advancedCacheManager = new CacheManager({
      redisInstanceName: 'performance-test',
      redisEnvironment: 'test',
      memoryCacheConfig: {
        maxSize: 5000,
        evictionPolicy: 'LRU' as any,
        defaultTTL: 3600000,
        cleanupInterval: 30000,
        enableMetrics: true,
        persistCriticalData: false
      },
      healthCheckInterval: 10000,
      failoverTimeout: 2000,
      enableDataSync: true,
      syncBatchSize: 50
    });

    await advancedCacheManager.initialize();

    // Generate test data
    testData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Test Item ${i}`,
      data: `Sample data ${i}`,
      timestamp: Date.now() + i,
      metadata: {
        type: 'test',
        category: `category-${i % 10}`,
        tags: [`tag-${i % 5}`, `tag-${(i + 1) % 5}`]
      }
    }));

    testKeys = testData.map((_, i) => `test-key-${i}`);
  });

  afterAll(async () => {
    // Clean up test data
    await cacheManager.clear();
    await advancedCacheManager.disconnect();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cacheManager.clear();
    await advancedCacheManager.flushall();
  });

  describe('Basic Cache Operations Performance', () => {
    it('should handle cache set operations efficiently', async () => {
      const batchSize = 1000;
      const testData = Array.from({ length: batchSize }, (_, i) => ({
        id: i,
        name: `Test Item ${i}`,
        data: `Sample data ${i}`
      }));

      const { duration } = await measureExecutionTime(async () => {
        for (let i = 0; i < batchSize; i++) {
          await cacheManager.set(`perf-test-${i}`, testData[i], { ttl: 3600 });
        }
      });

      const avgTimePerOperation = duration / batchSize;
      const operationsPerSecond = batchSize / (duration / 1000);

      console.log(`Cache set performance (${batchSize} operations):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(10); // Each set should be very fast
      expect(operationsPerSecond).toBeGreaterThan(100); // Should handle at least 100 ops/sec
    });

    it('should handle cache get operations efficiently', async () => {
      const batchSize = 1000;
      
      // Pre-populate cache
      for (let i = 0; i < batchSize; i++) {
        await cacheManager.set(`get-test-${i}`, { data: i }, { ttl: 3600 });
      }

      const { duration } = await measureExecutionTime(async () => {
        for (let i = 0; i < batchSize; i++) {
          await cacheManager.get(`get-test-${i}`);
        }
      });

      const avgTimePerOperation = duration / batchSize;
      const operationsPerSecond = batchSize / (duration / 1000);

      console.log(`Cache get performance (${batchSize} operations):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(5); // Gets should be faster than sets
      expect(operationsPerSecond).toBeGreaterThan(200); // Should handle at least 200 ops/sec
    });

    it('should handle cache delete operations efficiently', async () => {
      const batchSize = 500;
      
      // Pre-populate cache
      for (let i = 0; i < batchSize; i++) {
        await cacheManager.set(`delete-test-${i}`, { data: i }, { ttl: 3600 });
      }

      const { duration } = await measureExecutionTime(async () => {
        for (let i = 0; i < batchSize; i++) {
          await cacheManager.delete(`delete-test-${i}`);
        }
      });

      const avgTimePerOperation = duration / batchSize;
      const operationsPerSecond = batchSize / (duration / 1000);

      console.log(`Cache delete performance (${batchSize} operations):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(5); // Deletes should be very fast
      expect(operationsPerSecond).toBeGreaterThan(200);
    });
  });

  describe('Advanced Cache Operations Performance', () => {
    it('should handle hash operations efficiently', async () => {
      const batchSize = 500;
      const hashKey = 'test-hash';

      const { duration } = await measureExecutionTime(async () => {
        // Set hash fields
        for (let i = 0; i < batchSize; i++) {
          await advancedCacheManager.hset(hashKey, `field-${i}`, `value-${i}`);
        }

        // Get hash fields
        for (let i = 0; i < batchSize; i++) {
          await advancedCacheManager.hget(hashKey, `field-${i}`);
        }
      });

      const avgTimePerOperation = duration / (batchSize * 2); // 2 operations per item
      const operationsPerSecond = (batchSize * 2) / (duration / 1000);

      console.log(`Hash operations performance (${batchSize * 2} operations):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(5);
      expect(operationsPerSecond).toBeGreaterThan(200);
    });

    it('should handle multi-get operations efficiently', async () => {
      const batchSize = 100;
      const keys = Array.from({ length: batchSize }, (_, i) => `multi-get-test-${i}`);
      
      // Pre-populate cache
      for (const key of keys) {
        await cacheManager.set(key, { data: key }, { ttl: 3600 });
      }

      const { duration } = await measureExecutionTime(async () => {
        await advancedCacheManager.mget(...keys);
      });

      const avgTimePerOperation = duration / batchSize;
      const operationsPerSecond = batchSize / (duration / 1000);

      console.log(`Multi-get performance (${batchSize} keys):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per key: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Keys per second: ${operationsPerSecond.toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(10);
      expect(operationsPerSecond).toBeGreaterThan(50);
    });

    it('should handle multi-set operations efficiently', async () => {
      const batchSize = 100;
      const keyValues: [string, string][] = Array.from({ length: batchSize }, (_, i) => [
        `multi-set-test-${i}`,
        JSON.stringify({ data: i })
      ]);

      const { duration } = await measureExecutionTime(async () => {
        await advancedCacheManager.mset(keyValues);
      });

      const avgTimePerOperation = duration / batchSize;
      const operationsPerSecond = batchSize / (duration / 1000);

      console.log(`Multi-set performance (${batchSize} operations):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(10);
      expect(operationsPerSecond).toBeGreaterThan(50);
    });
  });

  describe('Cache Invalidation Performance', () => {
    it('should handle tag-based invalidation efficiently', async () => {
      const batchSize = 500;
      const tag = 'performance-test-tag';

      // Pre-populate cache with tagged items
      for (let i = 0; i < batchSize; i++) {
        await cacheManager.set(`tagged-item-${i}`, { data: i }, {
          ttl: 3600,
          tags: [tag, `subtag-${i % 5}`]
        });
      }

      const { duration } = await measureExecutionTime(async () => {
        await cacheManager.invalidateByTag(tag);
      });

      console.log(`Tag-based invalidation performance (${batchSize} items):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per item: ${(duration / batchSize).toFixed(2)}ms`);

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(duration / batchSize).toBeLessThan(2); // Less than 2ms per item
    });

    it('should handle pattern-based invalidation efficiently', async () => {
      const batchSize = 500;
      const pattern = 'pattern-test-*';

      // Pre-populate cache
      for (let i = 0; i < batchSize; i++) {
        await cacheManager.set(`pattern-test-${i}`, { data: i }, { ttl: 3600 });
      }

      const { duration } = await measureExecutionTime(async () => {
        await cacheManager.invalidateByPattern(pattern);
      });

      console.log(`Pattern-based invalidation performance (${batchSize} items):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per item: ${(duration / batchSize).toFixed(2)}ms`);

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(duration / batchSize).toBeLessThan(4); // Less than 4ms per item
    });
  });

  describe('Cache Fallback Performance', () => {
    it('should demonstrate Redis vs Memory cache performance', async () => {
      const testKey = 'fallback-test';
      const testData = { data: 'test data for fallback performance' };

      // Test memory cache performance
      const { duration: memoryDuration } = await measureExecutionTime(async () => {
        await cacheManager.set(testKey, testData, { ttl: 3600 });
        await cacheManager.get(testKey);
      });

      // Test advanced cache manager performance
      const { duration: advancedDuration } = await measureExecutionTime(async () => {
        await advancedCacheManager.set(testKey, testData, 3600);
        await advancedCacheManager.get(testKey);
      });

      console.log(`Cache fallback performance:`);
      console.log(`  Memory cache: ${memoryDuration}ms`);
      console.log(`  Advanced cache: ${advancedDuration}ms`);
      console.log(`  Performance difference: ${(advancedDuration / memoryDuration).toFixed(2)}x`);

      // Both should be reasonably fast
      expect(memoryDuration).toBeLessThan(50);
      expect(advancedDuration).toBeLessThan(100);
    });

    it('should handle failover scenarios efficiently', async () => {
      const testKey = 'failover-test';
      const testData = { data: 'failover test data' };

      // Simulate failover by switching to memory cache
      advancedCacheManager.switchToMemoryCache();

      const { duration } = await measureExecutionTime(async () => {
        await advancedCacheManager.set(testKey, testData, 3600);
        await advancedCacheManager.get(testKey);
        await advancedCacheManager.del(testKey);
      });

      console.log(`Failover performance: ${duration}ms`);
      expect(duration).toBeLessThan(50); // Fallback should be very fast
    });
  });

  describe('Concurrent Cache Operations', () => {
    it('should handle concurrent read operations efficiently', async () => {
      const concurrency = 50;
      const operationsPerWorker = 20;

      // Pre-populate cache
      for (let i = 0; i < concurrency * operationsPerWorker; i++) {
        await cacheManager.set(`concurrent-read-${i}`, { data: i }, { ttl: 3600 });
      }

      const concurrentRead = async (workerId: number) => {
        const results = [];
        
        for (let i = 0; i < operationsPerWorker; i++) {
          const key = `concurrent-read-${workerId * operationsPerWorker + i}`;
          const start = Date.now();
          
          const result = await cacheManager.get(key);
          
          results.push({
            duration: Date.now() - start,
            success: result !== null
          });
        }

        return results;
      };

      const { duration } = await measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrency }, (_, i) => concurrentRead(i));
        const results = await Promise.all(promises);
        
        const allResults = results.flat();
        const successCount = allResults.filter(r => r.success).length;
        const avgResponseTime = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;
        
        console.log(`Concurrent read operations results:`);
        console.log(`  Total operations: ${allResults.length}`);
        console.log(`  Successful operations: ${successCount}`);
        console.log(`  Success rate: ${(successCount / allResults.length * 100).toFixed(2)}%`);
        console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
        
        expect(successCount).toBe(allResults.length);
        expect(avgResponseTime).toBeLessThan(20);
      });

      const totalOperations = concurrency * operationsPerWorker;
      const operationsPerSecond = totalOperations / (duration / 1000);

      console.log(`Concurrent read performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(operationsPerSecond).toBeGreaterThan(100);
    });

    it('should handle concurrent write operations efficiently', async () => {
      const concurrency = 20;
      const operationsPerWorker = 10;

      const concurrentWrite = async (workerId: number) => {
        const results = [];
        
        for (let i = 0; i < operationsPerWorker; i++) {
          const key = `concurrent-write-${workerId}-${i}`;
          const start = Date.now();
          
          await cacheManager.set(key, { workerId, i }, { ttl: 3600 });
          
          results.push({
            duration: Date.now() - start,
            success: true
          });
        }

        return results;
      };

      const { duration } = await measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrency }, (_, i) => concurrentWrite(i));
        const results = await Promise.all(promises);
        
        const allResults = results.flat();
        const successCount = allResults.filter(r => r.success).length;
        const avgResponseTime = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;
        
        console.log(`Concurrent write operations results:`);
        console.log(`  Total operations: ${allResults.length}`);
        console.log(`  Successful operations: ${successCount}`);
        console.log(`  Success rate: ${(successCount / allResults.length * 100).toFixed(2)}%`);
        console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
        
        expect(successCount).toBe(allResults.length);
        expect(avgResponseTime).toBeLessThan(50);
      });

      const totalOperations = concurrency * operationsPerWorker;
      const operationsPerSecond = totalOperations / (duration / 1000);

      console.log(`Concurrent write performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(operationsPerSecond).toBeGreaterThan(20);
    });
  });

  describe('Cache Memory Usage', () => {
    it('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const itemCount = 1000;

      // Add items to cache
      for (let i = 0; i < itemCount; i++) {
        await cacheManager.set(`memory-test-${i}`, {
          data: 'x'.repeat(1000), // 1KB per item
          id: i,
          timestamp: Date.now()
        }, { ttl: 3600 });
      }

      const afterSetMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (afterSetMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory usage during cache population:`);
      console.log(`  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  After population: ${(afterSetMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      console.log(`  Memory per item: ${(memoryIncrease * 1024 / itemCount).toFixed(2)}KB`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
      expect(memoryIncrease / itemCount * 1024).toBeLessThan(50); // Less than 50KB per item

      // Clear cache and check memory cleanup
      await cacheManager.clear();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterClearMemory = process.memoryUsage().heapUsed;
      const memoryAfterClear = (afterClearMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory after cache clear: ${(afterClearMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory retained: ${memoryAfterClear.toFixed(2)}MB`);

      // Most memory should be freed
      expect(memoryAfterClear).toBeLessThan(10); // Less than 10MB retained
    });
  });

  describe('Cache Performance Under Load', () => {
    it('should handle sustained load efficiently', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      const results = [];
      let operationCount = 0;

      while (Date.now() - startTime < duration) {
        const operationStart = Date.now();
        
        // Random operation
        const operation = Math.random();
        if (operation < 0.4) {
          // Set operation
          await cacheManager.set(`load-test-${operationCount}`, { data: operationCount }, { ttl: 3600 });
        } else if (operation < 0.8) {
          // Get operation
          await cacheManager.get(`load-test-${Math.max(0, operationCount - 10)}`);
        } else {
          // Delete operation
          await cacheManager.delete(`load-test-${Math.max(0, operationCount - 20)}`);
        }
        
        const operationTime = Date.now() - operationStart;
        results.push(operationTime);
        operationCount++;

        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const avgOperationTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxOperationTime = Math.max(...results);
      const operationsPerSecond = operationCount / (duration / 1000);

      console.log(`Sustained load test results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Total operations: ${operationCount}`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);
      console.log(`  Average operation time: ${avgOperationTime.toFixed(2)}ms`);
      console.log(`  Max operation time: ${maxOperationTime}ms`);

      expect(avgOperationTime).toBeLessThan(50);
      expect(maxOperationTime).toBeLessThan(200);
      expect(operationsPerSecond).toBeGreaterThan(20);
    });
  });

  describe('Cache Statistics and Metrics', () => {
    it('should provide accurate performance metrics', async () => {
      const operationCount = 100;

      // Perform operations
      for (let i = 0; i < operationCount; i++) {
        await cacheManager.set(`metrics-test-${i}`, { data: i }, { ttl: 3600 });
        await cacheManager.get(`metrics-test-${i}`);
      }

      const stats = cacheManager.getStats();

      console.log(`Cache statistics:`);
      console.log(`  Hits: ${stats.hits}`);
      console.log(`  Misses: ${stats.misses}`);
      console.log(`  Sets: ${stats.sets}`);
      console.log(`  Deletes: ${stats.deletes}`);
      console.log(`  Size: ${stats.size}`);
      console.log(`  Hit rate: ${stats.hitRate}%`);

      expect(stats.hits).toBe(operationCount);
      expect(stats.sets).toBe(operationCount);
      expect(stats.hitRate).toBe(100);
    });
  });
});