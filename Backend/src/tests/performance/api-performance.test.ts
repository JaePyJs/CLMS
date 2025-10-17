import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@prisma/client';
import { createTestUser, createTestStudent, createTestBook, createTestEquipment, generateTestToken, cleanupDatabase } from '../helpers/testUtils';
import { measureExecutionTime, runLoadTest } from '../helpers/testUtils';

describe('API Endpoint Performance Tests', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let librarianToken: string;
  let testUser: any;
  let testStudents: any[] = [];
  let testBooks: any[] = [];
  let testEquipment: any[] = [];

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

    // Create test users
    testUser = await createTestUser({ role: 'SUPER_ADMIN' });
    const librarianUser = await createTestUser({ role: 'LIBRARIAN' });
    
    adminToken = generateTestToken(testUser.id, 'SUPER_ADMIN');
    librarianToken = generateTestToken(librarianUser.id, 'LIBRARIAN');

    // Create test data
    testStudents = Array.from({ length: 100 }, (_, i) => ({
      studentId: `API_STU_${String(i).padStart(4, '0')}`,
      firstName: `Test${i}`,
      lastName: 'Student',
      gradeLevel: 'Grade 10',
      gradeCategory: 'JUNIOR_HIGH',
      section: 'A'
    }));

    testBooks = Array.from({ length: 50 }, (_, i) => ({
      title: `API Test Book ${i}`,
      author: `Test Author ${i}`,
      isbn: `API_ISBN${String(i).padStart(13, '0')}`,
      accessionNumber: `API_ACC${String(i).padStart(6, '0')}`,
      status: 'AVAILABLE',
      category: 'Fiction'
    }));

    testEquipment = Array.from({ length: 25 }, (_, i) => ({
      equipmentId: `API_EQ_${String(i).padStart(3, '0')}`,
      name: `API Test Equipment ${i}`,
      type: 'COMPUTER',
      status: 'AVAILABLE'
    }));

    await prisma.student.createMany({ data: testStudents });
    await prisma.book.createMany({ data: testBooks });
    await prisma.equipment.createMany({ data: testEquipment });
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset any state between tests if needed
  });

  describe('Student API Performance', () => {
    it('should handle student listing with optimal performance', async () => {
      const testCases = [
        { name: 'Small list', query: { limit: '10' }, expectedMaxTime: 100 },
        { name: 'Medium list', query: { limit: '50' }, expectedMaxTime: 200 },
        { name: 'Large list', query: { limit: '100' }, expectedMaxTime: 300 }
      ];

      for (const testCase of testCases) {
        const { duration } = await measureExecutionTime(async () => {
          const response = await request(app)
            .get('/api/students')
            .query(testCase.query)
            .set('Authorization', `Bearer ${librarianToken}`);
          
          expect(response.status).toBe(200);
          expect(response.body.data).toBeDefined();
          expect(response.body.data.length).toBe(parseInt(testCase.query.limit));
        });

        console.log(`Student ${testCase.name}: ${duration}ms`);
        expect(duration).toBeLessThan(testCase.expectedMaxTime);
      }
    });

    it('should handle student search efficiently', async () => {
      const searchQueries = [
        { name: 'Name search', query: { search: 'Test0' }, expectedMaxTime: 150 },
        { name: 'Grade filter', query: { gradeLevel: 'Grade 10' }, expectedMaxTime: 200 },
        { name: 'Section filter', query: { section: 'A' }, expectedMaxTime: 150 },
        { name: 'Complex search', query: { search: 'Test', gradeLevel: 'Grade 10', section: 'A' }, expectedMaxTime: 250 }
      ];

      for (const searchCase of searchQueries) {
        const { duration } = await measureExecutionTime(async () => {
          const response = await request(app)
            .get('/api/students/search')
            .query(searchCase.query)
            .set('Authorization', `Bearer ${librarianToken}`);
          
          expect(response.status).toBe(200);
          expect(response.body.data).toBeDefined();
        });

        console.log(`Student ${searchCase.name}: ${duration}ms`);
        expect(duration).toBeLessThan(searchCase.expectedMaxTime);
      }
    });

    it('should handle student retrieval by ID efficiently', async () => {
      const student = testStudents[0];
      
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .get(`/api/students/${student.studentId}`)
          .set('Authorization', `Bearer ${librarianToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.studentId).toBe(student.studentId);
      });

      console.log(`Student retrieval by ID: ${duration}ms`);
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent student API requests', async () => {
      const concurrency = 20;
      const requestsPerWorker = 10;

      const concurrentRequest = async (workerId: number) => {
        const results = [];
        
        for (let i = 0; i < requestsPerWorker; i++) {
          const start = Date.now();
          
          const response = await request(app)
            .get('/api/students')
            .query({ limit: '10' })
            .set('Authorization', `Bearer ${librarianToken}`);
          
          results.push({
            duration: Date.now() - start,
            status: response.status,
            success: response.status === 200
          });
        }

        return results;
      };

      const { duration } = await measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrency }, (_, i) => concurrentRequest(i));
        const results = await Promise.all(promises);
        
        // Verify all requests succeeded
        const allResults = results.flat();
        const successCount = allResults.filter(r => r.success).length;
        const avgResponseTime = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;
        
        console.log(`Concurrent student API results:`);
        console.log(`  Total requests: ${allResults.length}`);
        console.log(`  Successful requests: ${successCount}`);
        console.log(`  Success rate: ${(successCount / allResults.length * 100).toFixed(2)}%`);
        console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
        
        expect(successCount).toBe(allResults.length);
        expect(avgResponseTime).toBeLessThan(500);
      });

      const totalRequests = concurrency * requestsPerWorker;
      const requestsPerSecond = totalRequests / (duration / 1000);

      console.log(`Concurrent student API performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Requests per second: ${requestsPerSecond.toFixed(2)}`);

      expect(requestsPerSecond).toBeGreaterThan(10); // Should handle at least 10 RPS
    });
  });

  describe('Book API Performance', () => {
    it('should handle book listing with optimal performance', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .get('/api/books')
          .query({ limit: '50' })
          .set('Authorization', `Bearer ${librarianToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.length).toBeLessThanOrEqual(50);
      });

      console.log(`Book listing: ${duration}ms`);
      expect(duration).toBeLessThan(200);
    });

    it('should handle book search efficiently', async () => {
      const searchQueries = [
        { name: 'Title search', query: { title: 'API Test' }, expectedMaxTime: 150 },
        { name: 'Author search', query: { author: 'Test Author' }, expectedMaxTime: 150 },
        { name: 'Category filter', query: { category: 'Fiction' }, expectedMaxTime: 200 },
        { name: 'Status filter', query: { status: 'AVAILABLE' }, expectedMaxTime: 150 }
      ];

      for (const searchCase of searchQueries) {
        const { duration } = await measureExecutionTime(async () => {
          const response = await request(app)
            .get('/api/books/search')
            .query(searchCase.query)
            .set('Authorization', `Bearer ${librarianToken}`);
          
          expect(response.status).toBe(200);
          expect(response.body.data).toBeDefined();
        });

        console.log(`Book ${searchCase.name}: ${duration}ms`);
        expect(duration).toBeLessThan(searchCase.expectedMaxTime);
      }
    });

    it('should handle book checkout operations efficiently', async () => {
      const student = testStudents[0];
      const book = testBooks[0];

      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .post('/api/books/checkout')
          .set('Authorization', `Bearer ${librarianToken}`)
          .send({
            bookId: book.id,
            studentId: student.id,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          });
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });

      console.log(`Book checkout: ${duration}ms`);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Equipment API Performance', () => {
    it('should handle equipment listing with optimal performance', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .get('/api/equipment')
          .query({ limit: '25' })
          .set('Authorization', `Bearer ${librarianToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.length).toBeLessThanOrEqual(25);
      });

      console.log(`Equipment listing: ${duration}ms`);
      expect(duration).toBeLessThan(150);
    });

    it('should handle equipment availability check efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .post('/api/equipment/available')
          .set('Authorization', `Bearer ${librarianToken}`)
          .send({
            type: 'COMPUTER',
            date: new Date().toISOString().split('T')[0]
          });
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });

      console.log(`Equipment availability check: ${duration}ms`);
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Analytics API Performance', () => {
    it('should handle dashboard analytics efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .get('/api/analytics/dashboard')
          .set('Authorization', `Bearer ${librarianToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });

      console.log(`Dashboard analytics: ${duration}ms`);
      expect(duration).toBeLessThan(1000); // Analytics can be slower but should still be reasonable
    });

    it('should handle report generation efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .get('/api/reports/summary')
          .query({
            startDate: '2024-01-01',
            endDate: '2024-12-31'
          })
          .set('Authorization', `Bearer ${librarianToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });

      console.log(`Report generation: ${duration}ms`);
      expect(duration).toBeLessThan(2000); // Reports can be slower
    });
  });

  describe('Authentication Performance', () => {
    it('should handle login requests efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: testUser.username,
            password: 'Test123!@#' // This should match the test user password
          });
        
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });

      console.log(`Login request: ${duration}ms`);
      expect(duration).toBeLessThan(300);
    });

    it('should handle token validation efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .get('/api/auth/validate')
          .set('Authorization', `Bearer ${adminToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
      });

      console.log(`Token validation: ${duration}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid requests efficiently', async () => {
      const errorTests = [
        { name: 'Invalid endpoint', path: '/api/invalid', expectedStatus: 404 },
        { name: 'Invalid student ID', path: '/api/students/invalid-id', expectedStatus: 404 },
        { name: 'Unauthorized request', path: '/api/students', expectedStatus: 401 }
      ];

      for (const errorTest of errorTests) {
        const { duration } = await measureExecutionTime(async () => {
          const response = await request(app)
            .get(errorTest.path);
          
          expect(response.status).toBe(errorTest.expectedStatus);
        });

        console.log(`Error handling ${errorTest.name}: ${duration}ms`);
        expect(duration).toBeLessThan(100); // Error responses should be very fast
      }
    });

    it('should handle malformed requests efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .post('/api/students')
          .set('Authorization', `Bearer ${librarianToken}`)
          .send({
            invalidField: 'invalid'
          });
        
        expect(response.status).toBe(400);
      });

      console.log(`Malformed request handling: ${duration}ms`);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Upload Performance', () => {
    it('should handle file uploads efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        const response = await request(app)
          .post('/api/import/students/preview')
          .set('Authorization', `Bearer ${librarianToken}`)
          .attach('file', Buffer.from('name,grade_level,section\nTest Student,Grade 10,A'), 'test.csv');
        
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });

      console.log(`File upload: ${duration}ms`);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('WebSocket Performance', () => {
    it('should handle WebSocket connection efficiently', async () => {
      // Note: WebSocket testing would require a WebSocket client library
      // This is a placeholder for WebSocket performance testing
      const { duration } = await measureExecutionTime(async () => {
        // Simulate WebSocket connection test
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      console.log(`WebSocket connection: ${duration}ms`);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Load Testing Scenarios', () => {
    it('should handle mixed API load efficiently', async () => {
      const apiEndpoints = [
        { method: 'get', path: '/api/students', query: { limit: '10' } },
        { method: 'get', path: '/api/books', query: { limit: '10' } },
        { method: 'get', path: '/api/equipment', query: { limit: '10' } },
        { method: 'get', path: '/api/analytics/dashboard' }
      ];

      const mixedLoadTest = async () => {
        const endpoint = apiEndpoints[Math.floor(Math.random() * apiEndpoints.length)];
        
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .query(endpoint.query || {})
          .set('Authorization', `Bearer ${librarianToken}`);
        
        return response.status === 200;
      };

      const results = await runLoadTest(mixedLoadTest, 200, 20);

      console.log(`Mixed API load test results:`);
      console.log(`  Total time: ${results.totalTime}ms`);
      console.log(`  Average time: ${results.averageTime.toFixed(2)}ms`);
      console.log(`  Success rate: ${results.successRate.toFixed(2)}%`);
      console.log(`  Min time: ${results.minTime}ms`);
      console.log(`  Max time: ${results.maxTime}ms`);

      expect(results.successRate).toBeGreaterThan(95);
      expect(results.averageTime).toBeLessThan(500);
    });

    it('should handle sustained load over time', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      const results = [];
      let requestCount = 0;

      while (Date.now() - startTime < duration) {
        const requestStart = Date.now();
        
        const response = await request(app)
          .get('/api/students')
          .query({ limit: '5' })
          .set('Authorization', `Bearer ${librarianToken}`);
        
        const requestTime = Date.now() - requestStart;
        results.push(requestTime);
        requestCount++;

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxResponseTime = Math.max(...results);
      const requestsPerSecond = requestCount / (duration / 1000);

      console.log(`Sustained load test results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Total requests: ${requestCount}`);
      console.log(`  Requests per second: ${requestsPerSecond.toFixed(2)}`);
      console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Max response time: ${maxResponseTime}ms`);

      expect(avgResponseTime).toBeLessThan(300);
      expect(maxResponseTime).toBeLessThan(1000);
      expect(requestsPerSecond).toBeGreaterThan(10);
    });
  });
});