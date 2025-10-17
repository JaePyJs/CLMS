import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { measureExecutionTime, runLoadTest } from '../helpers/testUtils';
import { PrismaClient } from '@prisma/client';
import { StudentsRepository } from '@/repositories/students.repository';
import { BooksRepository } from '@/repositories/books.repository';
import { cacheManager } from '@/utils/caching';
import { CacheManager } from '@/cache/cacheManager';

describe('Memory Usage and Leak Detection Tests', () => {
  let prisma: PrismaClient;
  let studentsRepo: StudentsRepository;
  let booksRepo: BooksRepository;
  let advancedCacheManager: CacheManager;

  beforeAll(async () => {
    // Initialize test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.PERF_DATABASE_URL || process.env.DATABASE_URL
        }
      },
      log: ['warn', 'error']
    });

    studentsRepo = new StudentsRepository(prisma);
    booksRepo = new BooksRepository(prisma);

    // Initialize advanced cache manager
    advancedCacheManager = new CacheManager({
      redisInstanceName: 'memory-test',
      redisEnvironment: 'test',
      memoryCacheConfig: {
        maxSize: 10000,
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await advancedCacheManager.disconnect();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cacheManager.clear();
    await advancedCacheManager.flushall();
  });

  describe('Memory Usage Monitoring', () => {
    it('should monitor memory usage during database operations', async () => {
      const initialMemory = process.memoryUsage();
      const batchSize = 1000;

      console.log('Initial memory usage:');
      console.log(`  RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  External: ${(initialMemory.external / 1024 / 1024).toFixed(2)} MB`);

      // Create large batch of students
      const students = Array.from({ length: batchSize }, (_, i) => ({
        studentId: `MEM_STU_${String(i).padStart(4, '0')}`,
        firstName: `Memory${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      const { duration } = await measureExecutionTime(async () => {
        await prisma.student.createMany({ data: students });
      });

      const afterCreateMemory = process.memoryUsage();
      const createMemoryIncrease = (afterCreateMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after creating ${batchSize} students:`);
      console.log(`  RSS: ${(afterCreateMemory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(afterCreateMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Memory increase: ${createMemoryIncrease.toFixed(2)} MB`);
      console.log(`  Memory per record: ${(createMemoryIncrease * 1024 / batchSize).toFixed(2)} KB`);

      // Query all students
      const { duration: queryDuration } = await measureExecutionTime(async () => {
        await prisma.student.findMany();
      });

      const afterQueryMemory = process.memoryUsage();
      const queryMemoryIncrease = (afterQueryMemory.heapUsed - afterCreateMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after querying ${batchSize} students:`);
      console.log(`  RSS: ${(afterQueryMemory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(afterQueryMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Memory increase: ${queryMemoryIncrease.toFixed(2)} MB`);

      // Memory usage should be reasonable
      expect(createMemoryIncrease).toBeLessThan(50); // Less than 50MB for 1000 records
      expect(queryMemoryIncrease).toBeLessThan(20); // Less than 20MB for query results
    });

    it('should monitor memory usage during cache operations', async () => {
      const initialMemory = process.memoryUsage();
      const cacheSize = 2000;
      const itemSize = 1024; // 1KB per item

      console.log('Initial memory usage:');
      console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Populate cache with large items
      const largeData = 'x'.repeat(itemSize);
      const { duration } = await measureExecutionTime(async () => {
        for (let i = 0; i < cacheSize; i++) {
          await cacheManager.set(`cache-test-${i}`, {
            data: largeData,
            id: i,
            timestamp: Date.now(),
            metadata: {
              type: 'test',
              category: `category-${i % 10}`
            }
          }, { ttl: 3600 });
        }
      });

      const afterSetMemory = process.memoryUsage();
      const setMemoryIncrease = (afterSetMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after caching ${cacheSize} items:`);
      console.log(`  Heap Used: ${(afterSetMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Memory increase: ${setMemoryIncrease.toFixed(2)} MB`);
      console.log(`  Memory per item: ${(setMemoryIncrease * 1024 / cacheSize).toFixed(2)} KB`);

      // Retrieve all cached items
      const { duration: getDuration } = await measureExecutionTime(async () => {
        for (let i = 0; i < cacheSize; i++) {
          await cacheManager.get(`cache-test-${i}`);
        }
      });

      const afterGetMemory = process.memoryUsage();
      const getMemoryIncrease = (afterGetMemory.heapUsed - afterSetMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after retrieving ${cacheSize} items:`);
      console.log(`  Heap Used: ${(afterGetMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Memory increase: ${getMemoryIncrease.toFixed(2)} MB`);

      // Clear cache
      await cacheManager.clear();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterClearMemory = process.memoryUsage();
      const finalMemoryIncrease = (afterClearMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after clearing cache:`);
      console.log(`  Heap Used: ${(afterClearMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Memory retained: ${finalMemoryIncrease.toFixed(2)} MB`);

      // Memory should be mostly freed
      expect(setMemoryIncrease).toBeLessThan(100); // Less than 100MB for 2000 items
      expect(finalMemoryIncrease).toBeLessThan(10); // Less than 10MB retained after clear
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect memory leaks in database operations', async () => {
      const iterations = 5;
      const batchSize = 200;
      const memoryMeasurements = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        const beforeMemory = process.memoryUsage().heapUsed;

        // Create students
        const students = Array.from({ length: batchSize }, (_, i) => ({
          studentId: `LEAK_STU_${iteration}_${String(i).padStart(3, '0')}`,
          firstName: `Leak${iteration}_${i}`,
          lastName: 'Test',
          gradeLevel: 'Grade 10',
          gradeCategory: 'JUNIOR_HIGH',
          section: 'A'
        }));

        await prisma.student.createMany({ data: students });

        // Query students
        await prisma.student.findMany({
          where: { studentId: { startsWith: `LEAK_STU_${iteration}` } }
        });

        // Delete students
        await prisma.student.deleteMany({
          where: { studentId: { startsWith: `LEAK_STU_${iteration}` } }
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const afterMemory = process.memoryUsage().heapUsed;
        memoryMeasurements.push(afterMemory / 1024 / 1024); // MB

        console.log(`Iteration ${iteration + 1} memory: ${(afterMemory / 1024 / 1024).toFixed(2)} MB`);

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze memory growth
      const memoryGrowth = memoryMeasurements[memoryMeasurements.length - 1] - memoryMeasurements[0];
      const avgGrowthPerIteration = memoryGrowth / (iterations - 1);

      console.log('Memory leak analysis for database operations:');
      console.log(`  Initial memory: ${memoryMeasurements[0].toFixed(2)} MB`);
      console.log(`  Final memory: ${memoryMeasurements[memoryMeasurements.length - 1].toFixed(2)} MB`);
      console.log(`  Total growth: ${memoryGrowth.toFixed(2)} MB`);
      console.log(`  Average growth per iteration: ${avgGrowthPerIteration.toFixed(2)} MB`);

      // Memory growth should be minimal
      expect(avgGrowthPerIteration).toBeLessThan(5); // Less than 5MB per iteration
      expect(memoryGrowth).toBeLessThan(20); // Less than 20MB total growth
    });

    it('should detect memory leaks in cache operations', async () => {
      const iterations = 5;
      const cacheSize = 500;
      const memoryMeasurements = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        const beforeMemory = process.memoryUsage().heapUsed;

        // Populate cache
        for (let i = 0; i < cacheSize; i++) {
          await cacheManager.set(`leak-test-${iteration}-${i}`, {
            data: `x`.repeat(500), // 500 bytes per item
            id: i,
            iteration
          }, { ttl: 3600 });
        }

        // Retrieve from cache
        for (let i = 0; i < cacheSize; i++) {
          await cacheManager.get(`leak-test-${iteration}-${i}`);
        }

        // Clear cache for this iteration
        for (let i = 0; i < cacheSize; i++) {
          await cacheManager.delete(`leak-test-${iteration}-${i}`);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const afterMemory = process.memoryUsage().heapUsed;
        memoryMeasurements.push(afterMemory / 1024 / 1024); // MB

        console.log(`Cache iteration ${iteration + 1} memory: ${(afterMemory / 1024 / 1024).toFixed(2)} MB`);

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze memory growth
      const memoryGrowth = memoryMeasurements[memoryMeasurements.length - 1] - memoryMeasurements[0];
      const avgGrowthPerIteration = memoryGrowth / (iterations - 1);

      console.log('Memory leak analysis for cache operations:');
      console.log(`  Initial memory: ${memoryMeasurements[0].toFixed(2)} MB`);
      console.log(`  Final memory: ${memoryMeasurements[memoryMeasurements.length - 1].toFixed(2)} MB`);
      console.log(`  Total growth: ${memoryGrowth.toFixed(2)} MB`);
      console.log(`  Average growth per iteration: ${avgGrowthPerIteration.toFixed(2)} MB`);

      // Memory growth should be minimal
      expect(avgGrowthPerIteration).toBeLessThan(3); // Less than 3MB per iteration
      expect(memoryGrowth).toBeLessThan(10); // Less than 10MB total growth
    });

    it('should detect memory leaks in repository operations', async () => {
      const iterations = 5;
      const batchSize = 100;
      const memoryMeasurements = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        const beforeMemory = process.memoryUsage().heapUsed;

        // Create students using repository
        for (let i = 0; i < batchSize; i++) {
          await studentsRepo.create({
            studentId: `REPO_STU_${iteration}_${String(i).padStart(3, '0')}`,
            firstName: `Repo${iteration}_${i}`,
            lastName: 'Test',
            gradeLevel: 'Grade 10',
            gradeCategory: 'JUNIOR_HIGH',
            section: 'A'
          });
        }

        // Query students using repository
        await studentsRepo.findMany({ take: batchSize });

        // Update students using repository
        for (let i = 0; i < batchSize; i++) {
          await studentsRepo.updateByStudentId(
            `REPO_STU_${iteration}_${String(i).padStart(3, '0')}`,
            { firstName: `Updated${iteration}_${i}` }
          );
        }

        // Delete students using repository
        for (let i = 0; i < batchSize; i++) {
          await studentsRepo.deleteByStudentId(
            `REPO_STU_${iteration}_${String(i).padStart(3, '0')}`
          );
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const afterMemory = process.memoryUsage().heapUsed;
        memoryMeasurements.push(afterMemory / 1024 / 1024); // MB

        console.log(`Repository iteration ${iteration + 1} memory: ${(afterMemory / 1024 / 1024).toFixed(2)} MB`);

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze memory growth
      const memoryGrowth = memoryMeasurements[memoryMeasurements.length - 1] - memoryMeasurements[0];
      const avgGrowthPerIteration = memoryGrowth / (iterations - 1);

      console.log('Memory leak analysis for repository operations:');
      console.log(`  Initial memory: ${memoryMeasurements[0].toFixed(2)} MB`);
      console.log(`  Final memory: ${memoryMeasurements[memoryMeasurements.length - 1].toFixed(2)} MB`);
      console.log(`  Total growth: ${memoryGrowth.toFixed(2)} MB`);
      console.log(`  Average growth per iteration: ${avgGrowthPerIteration.toFixed(2)} MB`);

      // Memory growth should be minimal
      expect(avgGrowthPerIteration).toBeLessThan(5); // Less than 5MB per iteration
      expect(memoryGrowth).toBeLessThan(20); // Less than 20MB total growth
    });
  });

  describe('Memory Optimization', () => {
    it('should optimize memory usage with streaming operations', async () => {
      const initialMemory = process.memoryUsage();
      const largeDatasetSize = 5000;

      console.log('Initial memory usage:');
      console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Create large dataset in batches to avoid memory spikes
      const batchSize = 500;
      const batches = Math.ceil(largeDatasetSize / batchSize);

      const { duration } = await measureExecutionTime(async () => {
        for (let batch = 0; batch < batches; batch++) {
          const students = Array.from({ length: batchSize }, (_, i) => ({
            studentId: `STREAM_STU_${batch}_${String(i).padStart(3, '0')}`,
            firstName: `Stream${batch}_${i}`,
            lastName: 'Test',
            gradeLevel: 'Grade 10',
            gradeCategory: 'JUNIOR_HIGH',
            section: 'A'
          }));

          await prisma.student.createMany({ data: students });

          // Force garbage collection after each batch
          if (global.gc) {
            global.gc();
          }

          const currentMemory = process.memoryUsage();
          const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
          
          console.log(`  Batch ${batch + 1}/${batches} memory: ${memoryIncrease.toFixed(2)} MB`);
          
          // Memory should not grow excessively
          expect(memoryIncrease).toBeLessThan(30); // Less than 30MB per batch
        }
      });

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after streaming ${largeDatasetSize} records:`);
      console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Total memory increase: ${totalMemoryIncrease.toFixed(2)} MB`);
      console.log(`  Memory per record: ${(totalMemoryIncrease * 1024 / largeDatasetSize).toFixed(2)} KB`);

      // Memory usage should be efficient
      expect(totalMemoryIncrease).toBeLessThan(100); // Less than 100MB for 5000 records
      expect(totalMemoryIncrease * 1024 / largeDatasetSize).toBeLessThan(20); // Less than 20KB per record
    });

    it('should optimize memory usage with pagination', async () => {
      const initialMemory = process.memoryUsage();
      const totalRecords = 2000;
      const pageSize = 100;

      console.log('Initial memory usage:');
      console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Create test data
      const students = Array.from({ length: totalRecords }, (_, i) => ({
        studentId: `PAGE_STU_${String(i).padStart(4, '0')}`,
        firstName: `Page${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      await prisma.student.createMany({ data: students });

      const afterCreateMemory = process.memoryUsage();
      const createMemoryIncrease = (afterCreateMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after creating ${totalRecords} records: ${createMemoryIncrease.toFixed(2)} MB`);

      // Query with pagination
      const { duration } = await measureExecutionTime(async () => {
        for (let page = 0; page < totalRecords / pageSize; page++) {
          const results = await prisma.student.findMany({
            skip: page * pageSize,
            take: pageSize
          });

          // Process results (simulate some work)
          results.forEach(student => {
            student.firstName = student.firstName.toUpperCase();
          });

          // Force garbage collection after each page
          if (global.gc) {
            global.gc();
          }

          const currentMemory = process.memoryUsage();
          const memoryIncrease = (currentMemory.heapUsed - afterCreateMemory.heapUsed) / 1024 / 1024;
          
          console.log(`  Page ${page + 1} memory: ${memoryIncrease.toFixed(2)} MB`);
          
          // Memory should not grow excessively with pagination
          expect(memoryIncrease).toBeLessThan(10); // Less than 10MB per page
        }
      });

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after paginated processing:`);
      console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Total memory increase: ${totalMemoryIncrease.toFixed(2)} MB`);

      // Memory usage should be efficient with pagination
      expect(totalMemoryIncrease).toBeLessThan(50); // Less than 50MB total
    });
  });

  describe('Memory Stress Testing', () => {
    it('should handle memory pressure gracefully', async () => {
      const initialMemory = process.memoryUsage();
      const memoryThreshold = 200 * 1024 * 1024; // 200MB threshold
      let currentMemory = initialMemory.heapUsed;
      let itemCount = 0;

      console.log('Initial memory usage:');
      console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Keep adding items until memory threshold is approached
      while (currentMemory < initialMemory.heapUsed + memoryThreshold && itemCount < 10000) {
        const largeData = 'x'.repeat(10000); // 10KB per item
        
        await cacheManager.set(`stress-test-${itemCount}`, {
          data: largeData,
          id: itemCount,
          timestamp: Date.now()
        }, { ttl: 3600 });

        itemCount++;
        currentMemory = process.memoryUsage().heapUsed;

        if (itemCount % 100 === 0) {
          console.log(`  Items: ${itemCount}, Memory: ${(currentMemory / 1024 / 1024).toFixed(2)} MB`);
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory stress test results:`);
      console.log(`  Items created: ${itemCount}`);
      console.log(`  Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Memory increase: ${memoryIncrease.toFixed(2)} MB`);
      console.log(`  Memory per item: ${(memoryIncrease * 1024 / itemCount).toFixed(2)} KB`);

      // Test memory cleanup
      console.log('Testing memory cleanup...');

      // Clear half of the items
      for (let i = 0; i < itemCount / 2; i++) {
        await cacheManager.delete(`stress-test-${i}`);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const afterCleanupMemory = process.memoryUsage();
      const cleanupMemoryReduction = (finalMemory.heapUsed - afterCleanupMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after cleanup:`);
      console.log(`  Memory reduction: ${cleanupMemoryReduction.toFixed(2)} MB`);
      console.log(`  Current memory: ${(afterCleanupMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Clear remaining items
      await cacheManager.clear();

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalCleanupMemory = process.memoryUsage();
      const totalMemoryReduction = (finalMemory.heapUsed - finalCleanupMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after full cleanup:`);
      console.log(`  Total reduction: ${totalMemoryReduction.toFixed(2)} MB`);
      console.log(`  Final memory: ${(finalCleanupMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Memory should be mostly recovered
      expect(totalMemoryReduction).toBeGreaterThan(memoryIncrease * 0.8); // At least 80% recovered
    });

    it('should handle concurrent memory operations', async () => {
      const initialMemory = process.memoryUsage();
      const concurrency = 10;
      const operationsPerWorker = 100;

      console.log('Initial memory usage:');
      console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      const concurrentOperation = async (workerId: number) => {
        const items = [];
        
        for (let i = 0; i < operationsPerWorker; i++) {
          const key = `concurrent-${workerId}-${i}`;
          const data = {
            workerId,
            index: i,
            data: 'x'.repeat(1000), // 1KB per item
            timestamp: Date.now()
          };

          await cacheManager.set(key, data, { ttl: 3600 });
          items.push(key);
        }

        // Retrieve items
        for (const key of items) {
          await cacheManager.get(key);
        }

        // Clean up items
        for (const key of items) {
          await cacheManager.delete(key);
        }

        return items.length;
      };

      const { duration } = await measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrency }, (_, i) => concurrentOperation(i));
        const results = await Promise.all(promises);
        
        const totalOperations = results.reduce((sum, count) => sum + count, 0);
        console.log(`  Total operations: ${totalOperations}`);
        console.log(`  Operations per worker: ${totalOperations / concurrency}`);
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Concurrent memory operations results:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Memory increase: ${memoryIncrease.toFixed(2)} MB`);

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const afterGCMemory = process.memoryUsage();
      const finalMemoryIncrease = (afterGCMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory after garbage collection:`);
      console.log(`  Memory increase: ${finalMemoryIncrease.toFixed(2)} MB`);

      // Memory should be mostly recovered after GC
      expect(finalMemoryIncrease).toBeLessThan(20); // Less than 20MB retained
    });
  });
});