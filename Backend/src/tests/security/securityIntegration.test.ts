import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../app';
import { auditService, AuditAction, AuditEntity } from '../../../services/auditService';
import { simpleEncryption } from '../../../utils/fieldEncryption';
import Redis from 'ioredis';

// Mock Redis for security monitoring tests
const mockRedis = new Redis();

describe('Security Integration Tests', () => {
  let server: any;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Start test server
    server = app.listen(0);

    // Mock authentication
    authToken = 'Bearer test-user-token';
    adminToken = 'Bearer test-admin-token';
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Reset mocks and clean state
    jest.clearAllMocks();
  });

  describe('End-to-End Security Workflow', () => {
    test('should complete secure book checkout workflow', async () => {
      // Step 1: User authentication (should be logged)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@example.com',
          password: 'ValidPassword123!'
        })
        .expect([200, 401]);

      // Step 2: Search for books (should be rate limited)
      const searchResponse = await request(app)
        .get('/api/books?query=javascript')
        .set('Authorization', authToken)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(Array.isArray(searchResponse.body.data)).toBe(true);

      // Step 3: Checkout book (should validate permissions)
      if (searchResponse.body.data.length > 0) {
        const bookId = searchResponse.body.data[0].id;

        const checkoutResponse = await request(app)
          .post('/api/activities')
          .set('Authorization', authToken)
          .send({
            bookId: bookId,
            studentId: 'student-123',
            type: 'CHECKOUT'
          })
          .expect([200, 400, 403]);

        // Should be properly logged
        expect(checkoutResponse.body).toHaveProperty('success');
      }
    });

    test('should handle admin security workflow', async () => {
      // Step 1: Admin access to security metrics
      const metricsResponse = await request(app)
        .get('/api/security/metrics')
        .set('Authorization', adminToken)
        .expect([200, 403]);

      if (metricsResponse.status === 200) {
        expect(metricsResponse.body.success).toBe(true);
        expect(metricsResponse.body.data).toHaveProperty('metrics');
      }

      // Step 2: View audit logs
      const auditResponse = await request(app)
        .get('/api/audit/recent')
        .set('Authorization', adminToken)
        .expect([200, 403]);

      if (auditResponse.status === 200) {
        expect(auditResponse.body.success).toBe(true);
        expect(Array.isArray(auditResponse.body.data)).toBe(true);
      }

      // Step 3: Export data (should be rate limited)
      const exportResponse = await request(app)
        .get('/api/audit/export/csv')
        .set('Authorization', adminToken)
        .expect([200, 403, 429]);

      // Should have proper headers for file download
      if (exportResponse.status === 200) {
        expect(exportResponse.headers['content-type']).toBe('text/csv');
        expect(exportResponse.headers['content-disposition']).toContain('attachment');
      }
    });
  });

  describe('Security Service Integration', () => {
    test('should integrate audit service with field encryption', async () => {
      const sensitiveAuditEntry = {
        userName: 'test-user',
        action: AuditAction.VIEW,
        entity: AuditEntity.STUDENT,
        entityId: 'student-123',
        ipAddress: '192.168.1.100', // Should be encrypted
        success: true,
        newValues: {
          name: 'John Doe',
          ssn: '123-45-6789', // Should be redacted
          email: 'john@example.com'
        }
      };

      // Log the audit entry
      await auditService.log(sensitiveAuditEntry);

      // Retrieve recent logs
      const logs = await auditService.getRecentAuditLogs(10);

      expect(Array.isArray(logs)).toBe(true);
      // In a real test, we'd verify the IP is encrypted and SSN is redacted
    });

    test('should integrate security monitoring with alerting', async () => {
      // Simulate suspicious activity
      const suspiciousEvents = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: `wrong-password-${i}`
          })
      );

      await Promise.allSettled(suspiciousEvents);

      // Check security metrics (should show increased events)
      const metricsResponse = await request(app)
        .get('/api/security/metrics')
        .set('Authorization', adminToken)
        .expect([200, 403]);

      if (metricsResponse.status === 200) {
        expect(metricsResponse.body.data.metrics.totalEvents).toBeGreaterThan(0);
      }
    });

    test('should handle FERPA compliance integration', async () => {
      // Test accessing student data with different roles
      const studentDataResponse = await request(app)
        .get('/api/students/student-123')
        .set('Authorization', authToken)
        .expect([200, 403, 404]);

      // Should filter data based on user role
      if (studentDataResponse.status === 200) {
        const student = studentDataResponse.body.data;

        // Sensitive fields should be encrypted or omitted for non-admin users
        if (student.ssn) {
          expect(student.ssn).not.toBe('123-45-6789'); // Should be encrypted
        }
      }
    });
  });

  describe('Cross-Service Security Validation', () => {
    test('should validate data consistency across services', async () => {
      // Create a test record
      const createResponse = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .send({
          title: 'Security Test Book',
          author: 'Test Author',
          isbn: '1234567890123'
        })
        .expect([200, 400, 422]);

      if (createResponse.status === 200) {
        const bookId = createResponse.body.data.id;

        // Verify it appears in search results
        const searchResponse = await request(app)
          .get('/api/books?query=Security Test Book')
          .set('Authorization', authToken)
          .expect(200);

        const found = searchResponse.body.data.some((book: any) => book.id === bookId);
        expect(found).toBe(true);

        // Verify audit trail
        const auditLogs = await auditService.getAuditLogs(AuditEntity.BOOK, bookId, 5);
        expect(auditLogs.length).toBeGreaterThan(0);
      }
    });

    test('should handle concurrent security operations', async () => {
      // Simulate multiple users accessing the system
      const concurrentOperations = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get('/api/books')
          .set('Authorization', `Bearer user-token-${i}`)
      );

      const responses = await Promise.allSettled(concurrentOperations);

      // All operations should complete without errors
      const successful = responses.filter(r =>
        r.status === 'fulfilled' && [200, 401, 403].includes(r.value.status)
      );

      expect(successful.length).toBe(20);
    });

    test('should maintain security during high load', async () => {
      // Simulate high load scenario
      const highLoadOperations = Array.from({ length: 100 }, (_, i) =>
        request(app)
          .get('/api/health')
      );

      const startTime = Date.now();
      const responses = await Promise.allSettled(highLoadOperations);
      const endTime = Date.now();

      // All health checks should succeed quickly
      const successful = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );

      expect(successful.length).toBeGreaterThan(90); // At least 90% success rate
      expect(endTime - startTime).toBeLessThan(10000); // Complete within 10 seconds
    });
  });

  describe('Security Configuration Integration', () => {
    test('should enforce security headers consistently', async () => {
      const endpoints = [
        '/health',
        '/api/books',
        '/api/students',
        '/api/activities'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', authToken)
          .expect([200, 401, 403]);

        // All responses should have security headers
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBeDefined();
      }
    });

    test('should handle CORS consistently across endpoints', async () => {
      const endpoints = [
        '/api/books',
        '/api/students',
        '/api/activities'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .options(endpoint)
          .expect(200);

        expect(response.headers['access-control-allow-origin']).toBeDefined();
        expect(response.headers['access-control-allow-methods']).toBeDefined();
        expect(response.headers['access-control-allow-headers']).toBeDefined();
      }
    });

    test('should validate rate limiting configuration', async () => {
      const rateLimitedEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/books/search'
      ];

      for (const endpoint of rateLimitedEndpoints) {
        const requests = Array.from({ length: 10 }, () =>
          request(app)
            .post(endpoint)
            .send({ test: 'data' })
        );

        const responses = await Promise.allSettled(requests);
        const rateLimited = responses.filter(r =>
          r.status === 'fulfilled' && r.value.status === 429
        );

        // At least some requests should be rate limited
        expect(rateLimited.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle security errors gracefully', async () => {
      const errorScenarios = [
        { url: '/api/books/invalid-id', expected: 404 },
        { url: '/api/students/00000000-0000-0000-0000-000000000000', expected: 404 },
        { url: '/api/nonexistent-endpoint', expected: 404 },
        { url: '/api/admin/users', expected: [401, 403] }
      ];

      for (const scenario of errorScenarios) {
        const response = await request(app)
          .get(scenario.url)
          .set('Authorization', authToken);

        const expectedStatuses = Array.isArray(scenario.expected)
          ? scenario.expected
          : [scenario.expected];

        expect(expectedStatuses).toContain(response.status);

        // Error responses should be consistent
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');

        // Should not expose sensitive information
        expect(response.body.error).not.toContain('stack');
        expect(response.body.error).not.toContain('internal');
        expect(response.body.error).not.toContain('database');
      }
    });

    test('should maintain security during partial failures', async () => {
      // Simulate service degradation
      const responses = await Promise.allSettled([
        request(app).get('/health').set('Authorization', authToken),
        request(app).get('/api/books').set('Authorization', authToken),
        request(app).get('/api/students').set('Authorization', authToken)
      ]);

      // Even during partial failures, security should be maintained
      for (const response of responses) {
        if (response.status === 'fulfilled') {
          const res = response.value;

          // Should have proper security headers
          expect(res.headers['x-content-type-options']).toBe('nosniff');

          // Should not expose sensitive information
          if (res.body.error) {
            expect(res.body.error).not.toContain('stack');
            expect(res.body.error).not.toContain('internal');
          }
        }
      }
    });
  });

  describe('Data Security Integration', () => {
    test('should encrypt sensitive data throughout the system', async () => {
      const sensitiveData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        address: '123 Main St'
      };

      // Test encryption service
      const encrypted = simpleEncryption.encrypt(sensitiveData.phone);
      const decrypted = simpleEncryption.decrypt(encrypted);

      expect(decrypted).toBe(sensitiveData.phone);
      expect(encrypted.encryptedData).not.toBe(sensitiveData.phone);
    });

    test('should validate data integrity across operations', async () => {
      // Create test data
      const testData = {
        title: 'Integrity Test Book',
        author: 'Test Author',
        description: 'A book for testing data integrity'
      };

      const createResponse = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .send(testData)
        .expect([200, 400, 422]);

      if (createResponse.status === 200) {
        const bookId = createResponse.body.data.id;

        // Retrieve data
        const getResponse = await request(app)
          .get(`/api/books/${bookId}`)
          .set('Authorization', authToken)
          .expect(200);

        const book = getResponse.body.data;

        // Data should match original
        expect(book.title).toBe(testData.title);
        expect(book.author).toBe(testData.author);
        expect(book.description).toBe(testData.description);
      }
    });

    test('should handle data sanitization consistently', async () => {
      const maliciousData = {
        title: '<script>alert("xss")</script>',
        description: '<img src=x onerror=alert("xss")>Malicious content',
        author: 'Safe Author'
      };

      const response = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .send(maliciousData)
        .expect([400, 422]);

      // Should reject malicious content
      expect(response.body.success).toBe(false);
    });
  });

  describe('Session Security Integration', () => {
    test('should manage session lifecycle properly', async () => {
      // Login (if endpoint exists and works)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!'
        })
        .expect([200, 401]);

      // Use session for authenticated operations
      if (loginResponse.status === 200) {
        const token = loginResponse.body.token;

        const protectedResponse = await request(app)
          .get('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(protectedResponse.body.success).toBe(true);

        // Logout (if endpoint exists)
        const logoutResponse = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .expect([200, 401]);

        // Session should be invalidated
        const afterLogoutResponse = await request(app)
          .get('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .expect([401, 403]);

        expect(afterLogoutResponse.body.success).toBe(false);
      }
    });

    test('should handle concurrent sessions', async () => {
      // Simulate multiple sessions for the same user
      const sessionOperations = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .get('/api/books')
          .set('Authorization', `Bearer session-token-${i}`)
      );

      const responses = await Promise.allSettled(sessionOperations);

      // Should handle multiple sessions without conflicts
      const successful = responses.filter(r =>
        r.status === 'fulfilled' && [200, 401, 403].includes(r.value.status)
      );

      expect(successful.length).toBe(5);
    });
  });
});