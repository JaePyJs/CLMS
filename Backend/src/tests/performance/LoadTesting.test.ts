import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import autocannon from 'autocannon';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

// Import routes for testing
import studentRoutes from '@/routes/students';
import bookRoutes from '@/routes/books';
import equipmentRoutes from '@/routes/equipment';
import authRoutes from '@/routes/auth';

// Test utilities
import { TestDataFactory } from '../factories/TestDataFactory';
import { createTestPrisma } from '../setup-comprehensive';

describe('Load Testing - API Performance', () => {
  let app: express.Application;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    // Create Express app with production-like configuration
    app = express();

    // Production middleware
    app.use(helmet());
    app.use(compression());
    app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/students', studentRoutes);
    app.use('/api/books', bookRoutes);
    app.use('/api/equipment', equipmentRoutes);

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Start server
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.listen(0, (err?: Error) => {
        if (err) reject(err);
        else {
          const address = server.address();
          if (typeof address === 'string') {
            baseUrl = `http://localhost:${address}`;
          } else if (address && typeof address === 'object') {
            baseUrl = `http://localhost:${address.port}`;
          }
          resolve();
        }
      });
    });

    // Setup mock data
    const testStudents = TestDataFactory.createStudents(1000);
    const testBooks = TestDataFactory.createBooks(500);
    const testEquipment = TestDataFactory.createEquipmentList(100);

    const mockPrisma = createTestPrisma();
    mockPrisma.students.findMany.mockResolvedValue(testStudents as any);
    mockPrisma.students.count.mockResolvedValue(testStudents.length);
    mockPrisma.books.findMany.mockResolvedValue(testBooks as any);
    mockPrisma.books.count.mockResolvedValue(testBooks.length);
    mockPrisma.equipment.findMany.mockResolvedValue(testEquipment as any);
    mockPrisma.equipment.count.mockResolvedValue(testEquipment.length);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    TestDataFactory.resetCounter();
  });

  afterEach(() => {
    // Cleanup any test-specific state
  });

  const runAutocannon = async (options: autocannon.Options): Promise<autocannon.Result> => {
    return new Promise((resolve, reject) => {
      autocannon(options, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  describe('Basic API Load Tests', () => {
    it('should handle 100 concurrent requests to students endpoint', async () => {
      const result = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 100,
        duration: 10,
        amount: 1000,
        timeout: 30,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      console.log('Students Load Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);
      console.log(`- Latency (p95): ${result.latency.p95}ms`);
      console.log(`- Latency (p99): ${result.latency.p99}ms`);
      console.log(`- Throughput: ${result.throughput.average} req/sec`);
      console.log(`- Errors: ${result.errors}`);

      expect(result.requests.total).toBeGreaterThan(900);
      expect(result.latency.average).toBeLessThan(100);
      expect(result.latency.p95).toBeLessThan(200);
      expect(result.latency.p99).toBeLessThan(500);
      expect(result.throughput.average).toBeGreaterThan(50);
      expect(result.errors).toBe(0);
    });

    it('should handle sustained load over time', async () => {
      const result = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 50,
        duration: 30,
        timeout: 60,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      console.log('Sustained Load Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- Duration: ${result.duration}ms`);
      console.log(`- Throughput: ${result.throughput.average} req/sec`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);
      console.log(`- Errors: ${result.errors}`);

      expect(result.requests.total).toBeGreaterThan(1000);
      expect(result.latency.average).toBeLessThan(150);
      expect(result.throughput.average).toBeGreaterThan(30);
      expect(result.errors).toBe(0);
    });

    it('should handle mixed API endpoints concurrently', async () => {
      const result = await runAutocannon({
        url: `${baseUrl}/api`,
        connections: 100,
        duration: 15,
        amount: 1500,
        timeout: 45,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        requests: [
          {
            method: 'GET',
            path: '/api/students'
          },
          {
            method: 'GET',
            path: '/api/books'
          },
          {
            method: 'GET',
            path: '/api/equipment'
          },
          {
            method: 'GET',
            path: '/api/students?page=1&limit=10'
          },
          {
            method: 'GET',
            path: '/api/books?page=1&limit=10'
          }
        ]
      });

      console.log('Mixed Endpoints Load Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);
      console.log(`- Latency (p95): ${result.latency.p95}ms`);
      console.log(`- Throughput: ${result.throughput.average} req/sec`);
      console.log(`- Errors: ${result.errors}`);

      expect(result.requests.total).toBeGreaterThan(1200);
      expect(result.latency.average).toBeLessThan(200);
      expect(result.latency.p95).toBeLessThan(400);
      expect(result.throughput.average).toBeGreaterThan(60);
      expect(result.errors).toBe(0);
    });
  });

  describe('Write Operation Load Tests', () => {
    it('should handle concurrent student creation', async () => {
      const newStudent = {
        student_id: 'LOAD_TEST_001',
        first_name: 'Load',
        last_name: 'Test',
        grade_level: 'Grade 7',
        grade_category: 'GRADE_7',
        section: '7-A'
      };

      const result = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 20,
        duration: 10,
        amount: 100,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(newStudent)
      });

      console.log('Student Creation Load Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);
      console.log(`- Latency (p95): ${result.latency.p95}ms`);
      console.log(`- Throughput: ${result.throughput.average} req/sec`);
      console.log(`- Errors: ${result.errors}`);
      console.log(`- 2xx responses: ${result['2xx']}`);
      console.log(`- 4xx responses: ${result['4xx']}`);

      // Write operations typically have higher latency
      expect(result.latency.average).toBeLessThan(300);
      expect(result.latency.p95).toBeLessThan(600);
      expect(result.throughput.average).toBeGreaterThan(5);
      expect(result['2xx']).toBeGreaterThan(50);
    });

    it('should handle concurrent student updates', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Student'
      };

      const result = await runAutocannon({
        url: `${baseUrl}/api/students/test-student-id`,
        connections: 15,
        duration: 10,
        amount: 50,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(updateData)
      });

      console.log('Student Update Load Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);
      console.log(`- Latency (p95): ${result.latency.p95}ms`);
      console.log(`- Errors: ${result.errors}`);
      console.log(`- 2xx responses: ${result['2xx']}`);

      expect(result.latency.average).toBeLessThan(250);
      expect(result.latency.p95).toBeLessThan(500);
      expect(result['2xx']).toBeGreaterThan(30);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should handle requests to non-existent endpoints gracefully', async () => {
      const result = await runAutocannon({
        url: `${baseUrl}/api/nonexistent`,
        connections: 50,
        duration: 5,
        amount: 200,
        timeout: 30
      });

      console.log('Error Handling Load Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);
      console.log(`- 4xx responses: ${result['4xx']}`);
      console.log(`- 5xx responses: ${result['5xx']}`);

      expect(result['4xx']).toBeGreaterThan(180); // Should return 404
      expect(result['5xx']).toBe(0); // Should not crash
      expect(result.latency.average).toBeLessThan(50); // Fast error responses
    });

    it('should handle malformed requests gracefully', async () => {
      const result = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 30,
        duration: 5,
        amount: 100,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{"invalid": json content}' // Malformed JSON
      });

      console.log('Malformed Request Load Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- 4xx responses: ${result['4xx']}`);
      console.log(`- 5xx responses: ${result['5xx']}`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);

      expect(result['4xx']).toBeGreaterThan(80);
      expect(result['5xx']).toBe(0);
      expect(result.latency.average).toBeLessThan(100);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage during sustained load', async () => {
      const initialMemory = process.memoryUsage();

      const result = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 100,
        duration: 60, // Long duration to test memory stability
        timeout: 120,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log('Memory Usage Test Results:');
      console.log(`- Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Requests completed: ${result.requests.total}`);

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      expect(result.requests.total).toBeGreaterThan(2000);
      expect(result.errors).toBe(0);
    });

    it('should handle connection pooling efficiently', async () => {
      const result = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 200, // High connection count
        duration: 20,
        timeout: 60,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        pipelining: 4 // Test HTTP pipelining
      });

      console.log('Connection Pooling Test Results:');
      console.log(`- Connections: ${result.connections}`);
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- Throughput: ${result.throughput.average} req/sec`);
      console.log(`- Latency (avg): ${result.latency.average}ms`);
      console.log(`- Errors: ${result.errors}`);

      expect(result.throughput.average).toBeGreaterThan(100);
      expect(result.latency.average).toBeLessThan(150);
      expect(result.errors).toBe(0);
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should enforce rate limiting under excessive load', async () => {
      const result = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 500, // Very high connection count
        duration: 10,
        amount: 5000,
        timeout: 60,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      console.log('Rate Limiting Test Results:');
      console.log(`- Requests: ${result.requests.total}`);
      console.log(`- 2xx responses: ${result['2xx']}`);
      console.log(`- 4xx responses: ${result['4xx']}`);
      console.log(`- 5xx responses: ${result['5xx']}`);
      console.log(`- Errors: ${result.errors}`);

      // Some requests should be rate limited (429)
      expect(result['2xx']).toBeGreaterThan(0);
      expect(result['4xx']).toBeGreaterThan(0);
      expect(result['5xx']).toBe(0); // Server should not crash
    });

    it('should handle malicious requests gracefully', async () => {
      const maliciousPayloads = [
        { 'x-forwarded-for': '192.168.1.1' },
        { 'user-agent': 'Mozilla/5.0 (compatible; BadBot/1.0)' },
        { 'x-real-ip': '10.0.0.1' },
        { 'x-forwarded-host': 'malicious-site.com' }
      ];

      const results = [];

      for (const headers of maliciousPayloads) {
        const result = await runAutocannon({
          url: `${baseUrl}/api/students`,
          connections: 10,
          duration: 2,
          amount: 20,
          timeout: 30,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            ...headers
          }
        });

        results.push(result);
      }

      // Should handle malicious requests without crashing
      for (const result of results) {
        expect(result['5xx']).toBe(0);
        expect(result.latency.average).toBeLessThan(200);
      }
    });
  });

  describe('Performance Regression Tests', () => {
    it('should meet performance benchmarks for critical operations', async () => {
      const benchmarks = [
        {
          name: 'Student List',
          url: `${baseUrl}/api/students`,
          expectedThroughput: 100,
          expectedLatency: 100
        },
        {
          name: 'Book List',
          url: `${baseUrl}/api/books`,
          expectedThroughput: 80,
          expectedLatency: 120
        },
        {
          name: 'Equipment List',
          url: `${baseUrl}/api/equipment`,
          expectedThroughput: 60,
          expectedLatency: 150
        }
      ];

      for (const benchmark of benchmarks) {
        const result = await runAutocannon({
          url: benchmark.url,
          connections: 50,
          duration: 10,
          timeout: 30,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        });

        console.log(`${benchmark.name} Performance:`);
        console.log(`- Throughput: ${result.throughput.average} req/sec (expected: ${benchmark.expectedThroughput})`);
        console.log(`- Latency: ${result.latency.average}ms (expected: <${benchmark.expectedLatency}ms)`);

        expect(result.throughput.average).toBeGreaterThan(benchmark.expectedThroughput);
        expect(result.latency.average).toBeLessThan(benchmark.expectedLatency);
        expect(result.errors).toBe(0);
      }
    });

    it('should maintain performance during peak hours simulation', async () => {
      // Simulate peak hour traffic pattern
      const peakHourLoad = async () => {
        return runAutocannon({
          url: `${baseUrl}/api/students`,
          connections: 150,
          duration: 5,
          timeout: 30,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        });
      };

      const results = await Promise.all([
        peakHourLoad(),
        peakHourLoad(),
        peakHourLoad()
      ]);

      const avgThroughput = results.reduce((sum, r) => sum + r.throughput.average, 0) / results.length;
      const avgLatency = results.reduce((sum, r) => sum + r.latency.average, 0) / results.length;
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

      console.log('Peak Hour Simulation Results:');
      console.log(`- Average throughput: ${avgThroughput.toFixed(2)} req/sec`);
      console.log(`- Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`- Total errors: ${totalErrors}`);

      expect(avgThroughput).toBeGreaterThan(80);
      expect(avgLatency).toBeLessThan(200);
      expect(totalErrors).toBe(0);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with increased load', async () => {
      const connectionCounts = [25, 50, 100, 200];
      const results = [];

      for (const connections of connectionCounts) {
        const result = await runAutocannon({
          url: `${baseUrl}/api/students`,
          connections,
          duration: 10,
          timeout: 30,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        });

        results.push({ connections, throughput: result.throughput.average, latency: result.latency.average });
      }

      console.log('Scalability Test Results:');
      results.forEach(r => {
        console.log(`- ${r.connections} connections: ${r.throughput.toFixed(2)} req/sec, ${r.latency.toFixed(2)}ms latency`);
      });

      // Check if throughput scales reasonably (not necessarily linear due to system limits)
      expect(results[1].throughput).toBeGreaterThan(results[0].throughput * 1.5);
      expect(results[2].throughput).toBeGreaterThan(results[1].throughput * 1.5);

      // Latency shouldn't increase disproportionately
      expect(results[3].latency).toBeLessThan(results[0].latency * 4);
    });

    it('should recover gracefully from load spikes', async () => {
      // Baseline performance
      const baseline = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 20,
        duration: 5,
        timeout: 30,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      // Load spike
      const spike = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 200,
        duration: 10,
        timeout: 60,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      // Recovery period
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Post-spike performance
      const recovery = await runAutocannon({
        url: `${baseUrl}/api/students`,
        connections: 20,
        duration: 5,
        timeout: 30,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      console.log('Load Spike Recovery Test Results:');
      console.log(`- Baseline throughput: ${baseline.throughput.average} req/sec`);
      console.log(`- Spike throughput: ${spike.throughput.average} req/sec`);
      console.log(`- Recovery throughput: ${recovery.throughput.average} req/sec`);

      // Should recover to at least 80% of baseline performance
      expect(recovery.throughput.average).toBeGreaterThan(baseline.throughput.average * 0.8);
      expect(recovery.latency.average).toBeLessThan(baseline.latency.average * 1.5);
    });
  });
});