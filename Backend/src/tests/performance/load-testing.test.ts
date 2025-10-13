import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import TestDatabaseManager from '../utils/testDatabase';
import AuthTestHelper from '../utils/authHelpers';

describe('Load Testing and Performance Benchmarks', () => {
  let testDb: TestDatabaseManager;
  let authHelper: AuthTestHelper;
  let testTokens: any[];

  beforeAll(async () => {
    // Initialize test database
    testDb = new TestDatabaseManager({
      databaseUrl: process.env.DATABASE_URL || '',
      resetBeforeEachTest: false,
      seedTestData: true
    });

    await testDb.setup();
    authHelper = new AuthTestHelper();

    // Create test tokens for different user roles
    testTokens = await Promise.all([
      authHelper.loginAsRole('SUPER_ADMIN'),
      authHelper.loginAsRole('ADMIN'),
      authHelper.loginAsRole('LIBRARIAN'),
      authHelper.loginAsRole('ASSISTANT'),
      authHelper.loginAsRole('VIEWER')
    ]);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  /**
   * Performance metrics collector
   */
  class PerformanceMetrics {
    private responseTimes: number[] = [];
    private successCount: number = 0;
    private errorCount: number = 0;
    private timeoutCount: number = 0;

    addResponseTime(time: number, success: boolean, isTimeout: boolean = false): void {
      this.responseTimes.push(time);
      if (success) {
        this.successCount++;
      } else {
        this.errorCount++;
      }
      if (isTimeout) {
        this.timeoutCount++;
      }
    }

    getMetrics() {
      const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
      const totalRequests = this.responseTimes.length;

      return {
        totalRequests,
        successCount: this.successCount,
        errorCount: this.errorCount,
        timeoutCount: this.timeoutCount,
        successRate: (this.successCount / totalRequests) * 100,
        averageResponseTime: this.responseTimes.reduce((a, b) => a + b, 0) / totalRequests,
        minResponseTime: Math.min(...this.responseTimes),
        maxResponseTime: Math.max(...this.responseTimes),
        medianResponseTime: sortedTimes[Math.floor(sortedTimes.length / 2)],
        p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
        p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
      };
    }

    reset(): void {
      this.responseTimes = [];
      this.successCount = 0;
      this.errorCount = 0;
      this.timeoutCount = 0;
    }
  }

  /**
   * Load test executor
   */
  async function runLoadTest(
    testName: string,
    requestFn: () => Promise<request.Response>,
    concurrency: number = 10,
    totalRequests: number = 100,
    timeoutMs: number = 5000
  ): Promise<{ testName: string; metrics: any; passed: boolean }> {
    const metrics = new PerformanceMetrics();
    const startTime = Date.now();

    console.log(`Running load test: ${testName} (${totalRequests} requests, ${concurrency} concurrent)`);

    // Create batches of concurrent requests
    const batchSize = Math.ceil(totalRequests / concurrency);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      const batch = Math.min(batchSize, totalRequests - i * batchSize);
      if (batch <= 0) break;

      const batchPromises = Array(batch).fill(null).map(async () => {
        const requestStart = Date.now();

        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
          );

          const response = await Promise.race([
            requestFn(),
            timeoutPromise
          ]) as request.Response;

          const requestTime = Date.now() - requestStart;
          const success = response.status >= 200 && response.status < 400;
          const isTimeout = requestTime >= timeoutMs;

          metrics.addResponseTime(requestTime, success, isTimeout);
        } catch (error: any) {
          const requestTime = Date.now() - requestStart;
          const isTimeout = error.message === 'Request timeout';

          metrics.addResponseTime(requestTime, false, isTimeout);
        }
      });

      promises.push(Promise.all(batchPromises).then(() => {}));
    }

    await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    const resultMetrics = metrics.getMetrics();
    resultMetrics.totalTime = totalTime;
    resultMetrics.requestsPerSecond = (totalRequests / totalTime) * 1000;

    // Performance benchmarks
    const benchmarks = {
      maxAverageResponseTime: 500, // 500ms
      maxP95ResponseTime: 1000,    // 1s
      minSuccessRate: 95,           // 95%
      minRequestsPerSecond: 10     // 10 RPS
    };

    const passed =
      resultMetrics.averageResponseTime <= benchmarks.maxAverageResponseTime &&
      resultMetrics.p95ResponseTime <= benchmarks.maxP95ResponseTime &&
      resultMetrics.successRate >= benchmarks.minSuccessRate &&
      resultMetrics.requestsPerSecond >= benchmarks.minRequestsPerSecond;

    console.log(`Load test completed: ${testName}`);
    console.log(`  Requests: ${resultMetrics.totalRequests}`);
    console.log(`  Success Rate: ${resultMetrics.successRate.toFixed(2)}%`);
    console.log(`  Avg Response Time: ${resultMetrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${resultMetrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`  RPS: ${resultMetrics.requestsPerSecond.toFixed(2)}`);
    console.log(`  Passed: ${passed}`);

    return {
      testName,
      metrics: resultMetrics,
      passed
    };
  }

  describe('Basic API Performance Tests', () => {
    it('should handle concurrent student listing requests', async () => {
      const result = await runLoadTest(
        'Student List API',
        () => authHelper.authenticatedRequest('get', '/api/students', testTokens[0], null, { limit: '20' }),
        20,    // concurrency
        200    // total requests
      );

      expect(result.metrics.successRate).toBeGreaterThan(95);
      expect(result.metrics.averageResponseTime).toBeLessThan(500);
      expect(result.metrics.p95ResponseTime).beLessThan(1000);
      expect(result.passed).toBe(true);
    });

    it('should handle concurrent book listing requests', async () => {
      const result = await runLoadTest(
        'Book List API',
        () => authHelper.authenticatedRequest('get', '/api/books', testTokens[2], null, { limit: '20' }),
        15,
        150
      );

      expect(result.metrics.successRate).toBeGreaterThan(95);
      expect(result.metrics.averageResponseTime).toBeLessThan(500);
      expect(result.passed).toBe(true);
    });

    it('should handle concurrent equipment listing requests', async () => {
      const result = await runLoadTest(
        'Equipment List API',
        () => authHelper.authenticatedRequest('get', '/api/equipment', testTokens[1], null, { limit: '20' }),
        15,
        150
      );

      expect(result.metrics.successRate).toBeGreaterThan(95);
      expect(result.metrics.averageResponseTime).toBeLessThan(500);
      expect(result.passed).toBe(true);
    });

    it('should handle concurrent analytics requests', async () => {
      const result = await runLoadTest(
        'Analytics Metrics API',
        () => authHelper.authenticatedRequest('get', '/api/analytics/metrics', testTokens[0]),
        10,
        100
      );

      expect(result.metrics.successRate).toBeGreaterThan(90); // Analytics can be heavier
      expect(result.metrics.averageResponseTime).toBeLessThan(1000);
      expect(result.passed).toBe(true);
    });

    it('should handle concurrent authentication requests', async () => {
      const result = await runLoadTest(
        'Authentication API',
        () => request(app).post('/api/auth/login').send({
          username: 'superadmin',
          password: 'testpassword123'
        }),
        25,
        250
      );

      expect(result.metrics.successRate).toBeGreaterThan(95);
      expect(result.metrics.averageResponseTime).toBeLessThan(300);
      expect(result.passed).toBe(true);
    });
  });

  describe('Write Operation Performance Tests', () => {
    it('should handle concurrent student creation requests', async () => {
      let studentCounter = 0;

      const result = await runLoadTest(
        'Student Creation API',
        () => {
          const counter = ++studentCounter;
          return authHelper.authenticatedRequest('post', '/api/students', testTokens[1], {
            studentId: `PERF-${counter.toString().padStart(4, '0')}`,
            firstName: `Test${counter}`,
            lastName: 'Student',
            gradeLevel: 'Grade 10',
            gradeCategory: 'JUNIOR_HIGH',
            section: 'A'
          });
        },
        10,
        50
      );

      expect(result.metrics.successRate).toBeGreaterThan(90);
      expect(result.metrics.averageResponseTime).toBeLessThan(1000);
      expect(result.passed).toBe(true);
    });

    it('should handle concurrent activity creation requests', async () => {
      const result = await runLoadTest(
        'Activity Creation API',
        () => authHelper.authenticatedRequest('post', '/api/students/activities', testTokens[2], {
          studentId: 'student-001',
          activityType: 'COMPUTER_USE',
          timeLimitMinutes: 60,
          notes: 'Performance test activity'
        }),
        15,
        75
      );

      expect(result.metrics.successRate).toBeGreaterThan(90);
      expect(result.metrics.averageResponseTime).toBeLessThan(800);
      expect(result.passed).toBe(true);
    });

    it('should handle concurrent book checkout requests', async () => {
      const result = await runLoadTest(
        'Book Checkout API',
        () => authHelper.authenticatedRequest('post', '/api/books/checkout', testTokens[2], {
          bookId: 'book-001',
          studentId: 'student-001',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        }),
        10,
        30
      );

      expect(result.metrics.successRate).toBeGreaterThan(85); // Checkouts might fail due to availability
      expect(result.metrics.averageResponseTime).toBeLessThan(1000);
      expect(result.passed).toBe(true);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high load without crashing', async () => {
      const result = await runLoadTest(
        'High Load Test - Students',
        () => authHelper.authenticatedRequest('get', '/api/students', testTokens[Math.floor(Math.random() * testTokens.length)], null, { limit: '10' }),
        50,    // high concurrency
        500    // many requests
      );

      expect(result.metrics.successRate).toBeGreaterThan(90);
      expect(result.metrics.averageResponseTime).toBeLessThan(2000);
      expect(result.metrics.timeoutCount).toBeLessThan(result.metrics.totalRequests * 0.1); // Less than 10% timeouts
    });

    it('should handle sustained load over time', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      const results = [];

      while (Date.now() - startTime < duration) {
        const result = await runLoadTest(
          'Sustained Load Test',
          () => authHelper.authenticatedRequest('get', '/api/students', testTokens[0], null, { limit: '5' }),
          5,
          25
        );
        results.push(result);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check that performance didn't degrade significantly
      const avgSuccessRate = results.reduce((sum, r) => sum + r.metrics.successRate, 0) / results.length;
      const avgResponseTime = results.reduce((sum, r) => sum + r.metrics.averageResponseTime, 0) / results.length;

      expect(avgSuccessRate).toBeGreaterThan(90);
      expect(avgResponseTime).toBeLessThan(1000);

      console.log(`Sustained load test: ${results.length} batches`);
      console.log(`  Average Success Rate: ${avgSuccessRate.toFixed(2)}%`);
      console.log(`  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor memory usage during load testing', async () => {
      const initialMemory = process.memoryUsage();
      console.log('Initial memory usage:', {
        rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`
      });

      // Run a moderate load test
      await runLoadTest(
        'Memory Usage Test',
        () => authHelper.authenticatedRequest('get', '/api/students', testTokens[0], null, { limit: '50' }),
        20,
        200
      );

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log('Final memory usage:', {
        rss: `${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`
      });
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should detect potential memory leaks', async () => {
      const measurements = [];

      // Run multiple load tests and measure memory after each
      for (let i = 0; i < 5; i++) {
        await runLoadTest(
          `Memory Leak Test - Iteration ${i + 1}`,
          () => authHelper.authenticatedRequest('get', '/api/students', testTokens[0], null, { limit: '20' }),
          10,
          50
        );

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        measurements.push(process.memoryUsage().heapUsed);

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('Memory measurements across iterations:');
      measurements.forEach((mem, i) => {
        console.log(`  Iteration ${i + 1}: ${(mem / 1024 / 1024).toFixed(2)} MB`);
      });

      // Check if memory is growing consistently (potential leak)
      const memoryGrowth = measurements[measurements.length - 1] - measurements[0];
      const avgGrowthPerIteration = memoryGrowth / (measurements.length - 1);

      console.log(`Total memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Average growth per iteration: ${(avgGrowthPerIteration / 1024 / 1024).toFixed(2)} MB`);

      // Allow some memory growth but not excessive
      expect(avgGrowthPerIteration).toBeLessThan(10 * 1024 * 1024); // Less than 10MB per iteration
    });
  });

  describe('Database Connection Pool Testing', () => {
    it('should handle database connection limits gracefully', async () => {
      const result = await runLoadTest(
        'Database Connection Pool Test',
        () => authHelper.authenticatedRequest('get', '/api/students', testTokens[0], null, { limit: '100' }),
        30,    // High concurrency to test connection pool
        300    // Many requests
      );

      expect(result.metrics.successRate).toBeGreaterThan(85);
      expect(result.metrics.averageResponseTime).toBeLessThan(3000); // Allow more time due to connection pooling
      expect(result.metrics.timeoutCount).toBeLessThan(result.metrics.totalRequests * 0.2);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should handle concurrent invalid requests gracefully', async () => {
      const result = await runLoadTest(
        'Invalid Requests Load Test',
        () => authHelper.authenticatedRequest('get', '/api/students/invalid-id-format', testTokens[0]),
        20,
        100
      );

      // All should return 404, but server should remain responsive
      expect(result.metrics.successRate).toBe(0); // All should fail with 404
      expect(result.metrics.averageResponseTime).toBeLessThan(200);
      expect(result.metrics.errorCount).toBe(result.metrics.totalRequests);
    });

    it('should handle mixed valid and invalid requests', async () => {
      let requestCounter = 0;

      const result = await runLoadTest(
        'Mixed Requests Load Test',
        () => {
          requestCounter++;
          // Mix of valid and invalid requests (70% valid, 30% invalid)
          if (requestCounter % 10 < 7) {
            return authHelper.authenticatedRequest('get', '/api/students', testTokens[0], null, { limit: '10' });
          } else {
            return authHelper.authenticatedRequest('get', '/api/students/invalid', testTokens[0]);
          }
        },
        25,
        200
      );

      expect(result.metrics.averageResponseTime).toBeLessThan(500);
      expect(result.metrics.successRate).toBeGreaterThan(60); // At least valid requests should succeed
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain performance benchmarks across multiple runs', async () => {
      const runs = [];
      const numRuns = 3;

      for (let i = 0; i < numRuns; i++) {
        const result = await runLoadTest(
          `Performance Regression Test - Run ${i + 1}`,
          () => authHelper.authenticatedRequest('get', '/api/students', testTokens[0], null, { limit: '50' }),
          15,
          100
        );

        runs.push(result.metrics);

        // Wait between runs
        if (i < numRuns - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Analyze performance consistency
      const avgResponseTimes = runs.map(r => r.averageResponseTime);
      const p95ResponseTimes = runs.map(r => r.p95ResponseTime);
      const successRates = runs.map(r => r.successRate);

      const avgResponseTimeStdDev = calculateStandardDeviation(avgResponseTimes);
      const p95ResponseTimeStdDev = calculateStandardDeviation(p95ResponseTimes);
      const successRateStdDev = calculateStandardDeviation(successRates);

      console.log('Performance consistency analysis:');
      console.log(`  Average Response Time - Mean: ${(avgResponseTimes.reduce((a, b) => a + b) / avgResponseTimes.length).toFixed(2)}ms, StdDev: ${avgResponseTimeStdDev.toFixed(2)}ms`);
      console.log(`  P95 Response Time - Mean: ${(p95ResponseTimes.reduce((a, b) => a + b) / p95ResponseTimes.length).toFixed(2)}ms, StdDev: ${p95ResponseTimeStdDev.toFixed(2)}ms`);
      console.log(`  Success Rate - Mean: ${(successRates.reduce((a, b) => a + b) / successRates.length).toFixed(2)}%, StdDev: ${successRateStdDev.toFixed(2)}%`);

      // Performance should be consistent (low standard deviation)
      expect(avgResponseTimeStdDev).toBeLessThan(100); // Less than 100ms variation
      expect(p95ResponseTimeStdDev).toBeLessThan(200); // Less than 200ms variation
      expect(successRateStdDev).toBeLessThan(5); // Less than 5% variation
    });
  });

  /**
   * Calculate standard deviation
   */
  function calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDifferences.reduce((a, b) => a + b) / squaredDifferences.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Generate performance report
   */
  function generatePerformanceReport(testResults: any[]): void {
    console.log('\n=== PERFORMANCE TEST REPORT ===');

    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

    console.log('\nTest Results:');
    testResults.forEach(result => {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${status} ${result.testName}`);
      console.log(`    Success Rate: ${result.metrics.successRate.toFixed(2)}%`);
      console.log(`    Avg Response Time: ${result.metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`    P95 Response Time: ${result.metrics.p95ResponseTime.toFixed(2)}ms`);
      console.log(`    RPS: ${result.metrics.requestsPerSecond.toFixed(2)}`);
    });

    console.log('\n=== END REPORT ===\n');
  }
});