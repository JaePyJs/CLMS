import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { measureExecutionTime, runLoadTest } from '../helpers/testUtils';
import { PrismaClient } from '@prisma/client';
import { StudentsRepository } from '@/repositories/students.repository';
import { BooksRepository } from '@/repositories/books.repository';
import { EquipmentRepository } from '@/repositories/equipment.repository';
import { cacheManager } from '@/utils/caching';
import { CacheManager } from '@/cache/cacheManager';

describe('Performance Benchmarks and Baseline Metrics', () => {
  let prisma: PrismaClient;
  let studentsRepo: StudentsRepository;
  let booksRepo: BooksRepository;
  let equipmentRepo: EquipmentRepository;
  let advancedCacheManager: CacheManager;
  const benchmarkDir = join(process.cwd(), 'performance-benchmarks');
  const baselineFile = join(benchmarkDir, 'baseline-metrics.json');

  // Performance benchmark thresholds
  const BENCHMARK_THRESHOLDS = {
    database: {
      createStudent: 50, // ms
      readStudent: 30, // ms
      updateStudent: 40, // ms
      deleteStudent: 30, // ms
      batchCreate: 10, // ms per record
      complexQuery: 200, // ms
      transaction: 30 // ms per record
    },
    api: {
      studentList: 100, // ms
      bookList: 150, // ms
      equipmentList: 100, // ms
      searchQuery: 200, // ms
      analytics: 1000, // ms
      authentication: 300 // ms
    },
    import: {
      smallDataset: 2000, // ms for 100 records
      mediumDataset: 10000, // ms for 1000 records
      largeDataset: 30000, // ms for 5000 records
      typeInference: 5000, // ms for 1000 records
      dataTransform: 10000 // ms for 2000 records
    },
    cache: {
      setOperation: 10, // ms
      getOperation: 5, // ms
      deleteOperation: 5, // ms
      batchOperation: 2, // ms per operation
      invalidation: 100, // ms for 100 items
      concurrentOps: 20 // ms average for 50 concurrent ops
    },
    memory: {
      maxMemoryIncrease: 100, // MB for large operations
      maxMemoryPerRecord: 50, // KB
      maxMemoryGrowthPerIteration: 5, // MB for leak detection
      maxMemoryRetainedAfterCleanup: 10 // MB
    }
  };

  interface BaselineMetrics {
    timestamp: number;
    environment: string;
    nodeVersion: string;
    system: {
      platform: string;
      arch: string;
      cpuCount: number;
      totalMemory: number;
    };
    benchmarks: {
      database: Record<string, number>;
      api: Record<string, number>;
      import: Record<string, number>;
      cache: Record<string, number>;
      memory: Record<string, number>;
    };
  }

  beforeAll(async () => {
    // Create benchmark directory if it doesn't exist
    if (!existsSync(benchmarkDir)) {
      mkdirSync(benchmarkDir, { recursive: true });
    }

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
    equipmentRepo = new EquipmentRepository(prisma);

    // Initialize advanced cache manager
    advancedCacheManager = new CacheManager({
      redisInstanceName: 'benchmark-test',
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

  function getOrCreateBaseline(): BaselineMetrics {
    if (existsSync(baselineFile)) {
      try {
        const data = readFileSync(baselineFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        console.warn('Failed to load baseline metrics, creating new ones');
      }
    }

    // Create new baseline
    return {
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'test',
      nodeVersion: process.version,
      system: {
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('os').cpus().length,
        totalMemory: require('os').totalmem()
      },
      benchmarks: {
        database: {},
        api: {},
        import: {},
        cache: {},
        memory: {}
      }
    };
  }

  function saveBaseline(baseline: BaselineMetrics): void {
    writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
    console.log(`Baseline metrics saved to ${baselineFile}`);
  }

  function compareWithBenchmark(value: number, threshold: number, category: string, metric: string): void {
    const passed = value <= threshold;
    const ratio = value / threshold;
    
    console.log(`${category} ${metric}: ${value}ms (threshold: ${threshold}ms)`);
    
    if (!passed) {
      console.warn(`  ❌ FAILED - ${(ratio * 100).toFixed(0)}% of threshold`);
    } else if (ratio > 0.8) {
      console.log(`  ⚠️  WARNING - ${(ratio * 100).toFixed(0)}% of threshold`);
    } else {
      console.log(`  ✅ PASSED - ${(ratio * 100).toFixed(0)}% of threshold`);
    }
    
    expect(value).toBeLessThan(threshold);
  }

  describe('Database Performance Benchmarks', () => {
    it('should benchmark student CRUD operations', async () => {
      const baseline = getOrCreateBaseline();
      const results: Record<string, number> = {};

      // Create benchmark
      const studentData = {
        studentId: `BENCH_STU_${Date.now()}`,
        firstName: 'Benchmark',
        lastName: 'Student',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      };

      const { duration: createTime } = await measureExecutionTime(async () => {
        await studentsRepo.create(studentData);
      });
      results.createStudent = createTime;
      compareWithBenchmark(createTime, BENCHMARK_THRESHOLDS.database.createStudent, 'Database', 'createStudent');

      // Read benchmark
      const { duration: readTime } = await measureExecutionTime(async () => {
        await studentsRepo.findByStudentId(studentData.studentId);
      });
      results.readStudent = readTime;
      compareWithBenchmark(readTime, BENCHMARK_THRESHOLDS.database.readStudent, 'Database', 'readStudent');

      // Update benchmark
      const { duration: updateTime } = await measureExecutionTime(async () => {
        await studentsRepo.updateByStudentId(studentData.studentId, { firstName: 'Updated' });
      });
      results.updateStudent = updateTime;
      compareWithBenchmark(updateTime, BENCHMARK_THRESHOLDS.database.updateStudent, 'Database', 'updateStudent');

      // Delete benchmark
      const { duration: deleteTime } = await measureExecutionTime(async () => {
        await studentsRepo.deleteByStudentId(studentData.studentId);
      });
      results.deleteStudent = deleteTime;
      compareWithBenchmark(deleteTime, BENCHMARK_THRESHOLDS.database.deleteStudent, 'Database', 'deleteStudent');

      baseline.benchmarks.database = { ...baseline.benchmarks.database, ...results };
      saveBaseline(baseline);
    });

    it('should benchmark batch operations', async () => {
      const baseline = getOrCreateBaseline();
      const results: Record<string, number> = {};
      const batchSize = 100;

      // Batch create benchmark
      const students = Array.from({ length: batchSize }, (_, i) => ({
        studentId: `BATCH_STU_${Date.now()}_${i}`,
        firstName: `Batch${i}`,
        lastName: 'Student',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      const { duration: batchCreateTime } = await measureExecutionTime(async () => {
        await prisma.student.createMany({ data: students });
      });
      results.batchCreate = batchCreateTime / batchSize;
      compareWithBenchmark(results.batchCreate, BENCHMARK_THRESHOLDS.database.batchCreate, 'Database', 'batchCreate');

      // Complex query benchmark
      const { duration: complexQueryTime } = await measureExecutionTime(async () => {
        await prisma.student.findMany({
          where: {
            gradeLevel: 'Grade 10',
            section: 'A'
          },
          orderBy: { studentId: 'asc' },
          take: 50
        });
      });
      results.complexQuery = complexQueryTime;
      compareWithBenchmark(complexQueryTime, BENCHMARK_THRESHOLDS.database.complexQuery, 'Database', 'complexQuery');

      baseline.benchmarks.database = { ...baseline.benchmarks.database, ...results };
      saveBaseline(baseline);
    });

    it('should benchmark transaction operations', async () => {
      const baseline = getOrCreateBaseline();
      const transactionSize = 50;

      const { duration } = await measureExecutionTime(async () => {
        await prisma.$transaction(async (tx) => {
          for (let i = 0; i < transactionSize; i++) {
            await tx.student.create({
              data: {
                studentId: `TX_STU_${Date.now()}_${i}`,
                firstName: `Transaction${i}`,
                lastName: 'Student',
                gradeLevel: 'Grade 10',
                gradeCategory: 'JUNIOR_HIGH',
                section: 'A'
              }
            });
          }
        });
      });

      const avgTimePerRecord = duration / transactionSize;
      baseline.benchmarks.database.transaction = avgTimePerRecord;
      saveBaseline(baseline);

      compareWithBenchmark(avgTimePerRecord, BENCHMARK_THRESHOLDS.database.transaction, 'Database', 'transaction');
    });
  });

  describe('API Performance Benchmarks', () => {
    it('should benchmark API endpoints', async () => {
      const baseline = getOrCreateBaseline();
      const results: Record<string, number> = {};

      // Create test data
      const testStudents = Array.from({ length: 100 }, (_, i) => ({
        studentId: `API_BENCH_${String(i).padStart(4, '0')}`,
        firstName: `API${i}`,
        lastName: 'Benchmark',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      const testBooks = Array.from({ length: 50 }, (_, i) => ({
        title: `API Benchmark Book ${i}`,
        author: `API Author ${i}`,
        isbn: `API_ISBN${String(i).padStart(13, '0')}`,
        accessionNumber: `API_ACC${String(i).padStart(6, '0')}`,
        status: 'AVAILABLE',
        category: 'Fiction'
      }));

      const testEquipment = Array.from({ length: 25 }, (_, i) => ({
        equipmentId: `API_EQ_${String(i).padStart(3, '0')}`,
        name: `API Equipment ${i}`,
        type: 'COMPUTER',
        status: 'AVAILABLE'
      }));

      await prisma.student.createMany({ data: testStudents });
      await prisma.book.createMany({ data: testBooks });
      await prisma.equipment.createMany({ data: testEquipment });

      // Note: In a real implementation, these would be actual HTTP requests
      // For this benchmark, we'll simulate the database operations that would be triggered
      
      // Student list benchmark
      const { duration: studentListTime } = await measureExecutionTime(async () => {
        await prisma.student.findMany({ take: 50 });
      });
      results.studentList = studentListTime;
      compareWithBenchmark(studentListTime, BENCHMARK_THRESHOLDS.api.studentList, 'API', 'studentList');

      // Book list benchmark
      const { duration: bookListTime } = await measureExecutionTime(async () => {
        await prisma.book.findMany({ take: 25 });
      });
      results.bookList = bookListTime;
      compareWithBenchmark(bookListTime, BENCHMARK_THRESHOLDS.api.bookList, 'API', 'bookList');

      // Equipment list benchmark
      const { duration: equipmentListTime } = await measureExecutionTime(async () => {
        await prisma.equipment.findMany({ take: 25 });
      });
      results.equipmentList = equipmentListTime;
      compareWithBenchmark(equipmentListTime, BENCHMARK_THRESHOLDS.api.equipmentList, 'API', 'equipmentList');

      // Search query benchmark
      const { duration: searchTime } = await measureExecutionTime(async () => {
        await prisma.student.findMany({
          where: {
            OR: [
              { firstName: { contains: 'API' } },
              { lastName: { contains: 'Benchmark' } }
            ]
          },
          take: 25
        });
      });
      results.searchQuery = searchTime;
      compareWithBenchmark(searchTime, BENCHMARK_THRESHOLDS.api.searchQuery, 'API', 'searchQuery');

      baseline.benchmarks.api = { ...baseline.benchmarks.api, ...results };
      saveBaseline(baseline);
    });
  });

  describe('Cache Performance Benchmarks', () => {
    it('should benchmark cache operations', async () => {
      const baseline = getOrCreateBaseline();
      const results: Record<string, number> = {};

      // Set operation benchmark
      const { duration: setTime } = await measureExecutionTime(async () => {
        await cacheManager.set('benchmark-key', { data: 'benchmark-value' }, { ttl: 3600 });
      });
      results.setOperation = setTime;
      compareWithBenchmark(setTime, BENCHMARK_THRESHOLDS.cache.setOperation, 'Cache', 'setOperation');

      // Get operation benchmark
      const { duration: getTime } = await measureExecutionTime(async () => {
        await cacheManager.get('benchmark-key');
      });
      results.getOperation = getTime;
      compareWithBenchmark(getTime, BENCHMARK_THRESHOLDS.cache.getOperation, 'Cache', 'getOperation');

      // Delete operation benchmark
      const { duration: deleteTime } = await measureExecutionTime(async () => {
        await cacheManager.delete('benchmark-key');
      });
      results.deleteOperation = deleteTime;
      compareWithBenchmark(deleteTime, BENCHMARK_THRESHOLDS.cache.deleteOperation, 'Cache', 'deleteOperation');

      // Batch operation benchmark
      const batchSize = 100;
      const { duration: batchTime } = await measureExecutionTime(async () => {
        for (let i = 0; i < batchSize; i++) {
          await cacheManager.set(`batch-key-${i}`, { data: i }, { ttl: 3600 });
        }
      });
      results.batchOperation = batchTime / batchSize;
      compareWithBenchmark(results.batchOperation, BENCHMARK_THRESHOLDS.cache.batchOperation, 'Cache', 'batchOperation');

      baseline.benchmarks.cache = { ...baseline.benchmarks.cache, ...results };
      saveBaseline(baseline);
    });

    it('should benchmark concurrent cache operations', async () => {
      const baseline = getOrCreateBaseline();
      const concurrency = 50;

      // Pre-populate cache
      for (let i = 0; i < concurrency; i++) {
        await cacheManager.set(`concurrent-key-${i}`, { data: i }, { ttl: 3600 });
      }

      const concurrentOperation = async (workerId: number) => {
        const start = Date.now();
        await cacheManager.get(`concurrent-key-${workerId}`);
        return Date.now() - start;
      };

      const { duration } = await measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrency }, (_, i) => concurrentOperation(i));
        await Promise.all(promises);
      });

      const avgTime = duration / concurrency;
      baseline.benchmarks.cache.concurrentOps = avgTime;
      saveBaseline(baseline);

      compareWithBenchmark(avgTime, BENCHMARK_THRESHOLDS.cache.concurrentOps, 'Cache', 'concurrentOps');
    });
  });

  describe('Memory Performance Benchmarks', () => {
    it('should benchmark memory usage', async () => {
      const baseline = getOrCreateBaseline();
      const results: Record<string, number> = {};

      const initialMemory = process.memoryUsage().heapUsed;
      const recordCount = 1000;

      // Create records and measure memory
      const students = Array.from({ length: recordCount }, (_, i) => ({
        studentId: `MEM_BENCH_${String(i).padStart(4, '0')}`,
        firstName: `Memory${i}`,
        lastName: 'Benchmark',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      await prisma.student.createMany({ data: students });

      const afterCreateMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (afterCreateMemory - initialMemory) / 1024 / 1024; // MB

      results.maxMemoryIncrease = memoryIncrease;
      compareWithBenchmark(memoryIncrease, BENCHMARK_THRESHOLDS.memory.maxMemoryIncrease, 'Memory', 'maxMemoryIncrease');

      const memoryPerRecord = memoryIncrease * 1024 / recordCount; // KB
      results.maxMemoryPerRecord = memoryPerRecord;
      compareWithBenchmark(memoryPerRecord, BENCHMARK_THRESHOLDS.memory.maxMemoryPerRecord, 'Memory', 'maxMemoryPerRecord');

      // Memory cleanup benchmark
      await prisma.student.deleteMany({
        where: { studentId: { startsWith: 'MEM_BENCH_' } }
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryRetained = (finalMemory - initialMemory) / 1024 / 1024; // MB

      results.maxMemoryRetainedAfterCleanup = memoryRetained;
      compareWithBenchmark(memoryRetained, BENCHMARK_THRESHOLDS.memory.maxMemoryRetainedAfterCleanup, 'Memory', 'maxMemoryRetainedAfterCleanup');

      baseline.benchmarks.memory = { ...baseline.benchmarks.memory, ...results };
      saveBaseline(baseline);
    });

    it('should benchmark memory leak detection', async () => {
      const baseline = getOrCreateBaseline();
      const iterations = 5;
      const batchSize = 200;
      const memoryMeasurements = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        const beforeMemory = process.memoryUsage().heapUsed;

        // Create and delete records
        const students = Array.from({ length: batchSize }, (_, i) => ({
          studentId: `LEAK_BENCH_${iteration}_${String(i).padStart(3, '0')}`,
          firstName: `Leak${iteration}_${i}`,
          lastName: 'Benchmark',
          gradeLevel: 'Grade 10',
          gradeCategory: 'JUNIOR_HIGH',
          section: 'A'
        }));

        await prisma.student.createMany({ data: students });
        await prisma.student.deleteMany({
          where: { studentId: { startsWith: `LEAK_BENCH_${iteration}` } }
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const afterMemory = process.memoryUsage().heapUsed;
        memoryMeasurements.push(afterMemory / 1024 / 1024); // MB
      }

      // Analyze memory growth
      const memoryGrowth = memoryMeasurements[memoryMeasurements.length - 1] - memoryMeasurements[0];
      const avgGrowthPerIteration = memoryGrowth / (iterations - 1);

      baseline.benchmarks.memory.maxMemoryGrowthPerIteration = avgGrowthPerIteration;
      saveBaseline(baseline);

      compareWithBenchmark(avgGrowthPerIteration, BENCHMARK_THRESHOLDS.memory.maxMemoryGrowthPerIteration, 'Memory', 'maxMemoryGrowthPerIteration');
    });
  });

  describe('Baseline Comparison', () => {
    it('should compare current performance with baseline', async () => {
      const baseline = getOrCreateBaseline();
      
      console.log('Baseline Performance Metrics:');
      console.log(`  Created: ${new Date(baseline.timestamp).toISOString()}`);
      console.log(`  Environment: ${baseline.environment}`);
      console.log(`  Node Version: ${baseline.nodeVersion}`);
      console.log(`  Platform: ${baseline.system.platform}`);
      console.log(`  Architecture: ${baseline.system.arch}`);
      console.log(`  CPU Count: ${baseline.system.cpuCount}`);
      console.log(`  Total Memory: ${(baseline.system.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
      
      console.log('\nDatabase Baselines:');
      Object.entries(baseline.benchmarks.database).forEach(([metric, value]) => {
        const threshold = (BENCHMARK_THRESHOLDS.database as any)[metric];
        if (threshold) {
          const ratio = value / threshold;
          console.log(`  ${metric}: ${value}ms (${ratio < 1 ? '✅' : ratio < 1.2 ? '⚠️' : '❌'} ${ratio.toFixed(2)}x of threshold)`);
        } else {
          console.log(`  ${metric}: ${value}ms`);
        }
      });
      
      console.log('\nAPI Baselines:');
      Object.entries(baseline.benchmarks.api).forEach(([metric, value]) => {
        const threshold = (BENCHMARK_THRESHOLDS.api as any)[metric];
        if (threshold) {
          const ratio = value / threshold;
          console.log(`  ${metric}: ${value}ms (${ratio < 1 ? '✅' : ratio < 1.2 ? '⚠️' : '❌'} ${ratio.toFixed(2)}x of threshold)`);
        } else {
          console.log(`  ${metric}: ${value}ms`);
        }
      });
      
      console.log('\nCache Baselines:');
      Object.entries(baseline.benchmarks.cache).forEach(([metric, value]) => {
        const threshold = (BENCHMARK_THRESHOLDS.cache as any)[metric];
        if (threshold) {
          const ratio = value / threshold;
          console.log(`  ${metric}: ${value}ms (${ratio < 1 ? '✅' : ratio < 1.2 ? '⚠️' : '❌'} ${ratio.toFixed(2)}x of threshold)`);
        } else {
          console.log(`  ${metric}: ${value}ms`);
        }
      });
      
      console.log('\nMemory Baselines:');
      Object.entries(baseline.benchmarks.memory).forEach(([metric, value]) => {
        const threshold = (BENCHMARK_THRESHOLDS.memory as any)[metric];
        if (threshold) {
          const ratio = value / threshold;
          console.log(`  ${metric}: ${value}${metric.includes('Memory') ? 'MB' : metric.includes('Record') ? 'KB' : 'ms'} (${ratio < 1 ? '✅' : ratio < 1.2 ? '⚠️' : '❌'} ${ratio.toFixed(2)}x of threshold)`);
        } else {
          const unit = metric.includes('Memory') ? 'MB' : metric.includes('Record') ? 'KB' : 'ms';
          console.log(`  ${metric}: ${value}${unit}`);
        }
      });

      // Verify baseline has data
      expect(Object.keys(baseline.benchmarks.database).length).toBeGreaterThan(0);
      expect(Object.keys(baseline.benchmarks.api).length).toBeGreaterThan(0);
      expect(Object.keys(baseline.benchmarks.cache).length).toBeGreaterThan(0);
      expect(Object.keys(baseline.benchmarks.memory).length).toBeGreaterThan(0);
    });
  });
});