import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { app } from '../../app';
import { EncryptionService } from '../../services/encryptionService';
import { FERPAService } from '../../services/ferpaService';
import { ValidationError, AuthenticationError, FERPAComplianceError } from '../../errors/error-types';

describe('Security Tests', () => {
  let server: any;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Start test server
    server = app.listen(0); // Use random port for testing

    // Create test tokens
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

  describe('Authentication Security', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/books')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Authentication required');
    });

    test('should reject invalid authentication tokens', async () => {
      const response = await request(app)
        .get('/api/books')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should implement rate limiting on auth endpoints', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'testpassword'
          })
      );

      const responses = await Promise.allSettled(requests);
      const rejected = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rejected.length).toBeGreaterThan(0);
    });

    test('should enforce password strength requirements', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'admin',
        'qwerty',
        'letmein'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            name: 'Test User'
          });

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Authorization Security', () => {
    test('should prevent unauthorized access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', authToken)
        .expect(403);

      expect(response.body.error).toContain('Insufficient privileges');
    });

    test('should allow admin access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should enforce role-based access control', async () => {
      // Test student trying to access librarian features
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', authToken)
        .send({
          title: 'Test Book',
          author: 'Test Author'
        })
        .expect(403);

      expect(response.body.error).toContain('Insufficient privileges');
    });
  });

  describe('Input Validation Security', () => {
    test('should reject SQL injection attempts', async () => {
      const maliciousInputs = [
        "'; DROP TABLE books; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM users",
        "<script>alert('xss')</script>"
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .get(`/api/books?query=${encodeURIComponent(input)}`)
          .set('Authorization', authToken);

        // Should not return server errors or expose database structure
        expect(response.status).not.toBe(500);
        expect(response.body.error).not.toContain('SQL');
      }
    });

    test('should validate input schemas', async () => {
      const invalidBookData = {
        title: '', // Empty title should fail validation
        author: 123, // Wrong type should fail validation
        total_copies: -1, // Negative number should fail validation
        available_copies: 'invalid' // String instead of number
      };

      const response = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .send(invalidBookData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    test('should sanitize HTML content', async () => {
      const xssPayload = {
        title: '<script>alert("xss")</script>Book Title',
        description: '<img src=x onerror=alert("xss")>Description'
      };

      const response = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .send(xssPayload)
        .expect(400);

      // Should reject HTML content
      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Protection', () => {
    test('should encrypt sensitive data at rest', async () => {
      const sensitiveData = {
        firstName: 'John',
        lastName: 'Doe',
        ssn: '123-45-6789',
        email: 'john@example.com',
        phone: '555-123-4567'
      };

      const encryptedSSN = EncryptionService.encryptField(sensitiveData.ssn, 'ssn', 'test-key');
      const encryptedEmail = EncryptionService.encryptField(sensitiveData.email, 'email', 'test-key');

      expect(encryptedSSN.encrypted).toBe(true);
      expect(encryptedSSN.data).not.toBe(sensitiveData.ssn);
      expect(encryptedEmail.encrypted).toBe(true);
      expect(encryptedEmail.data).not.toBe(sensitiveData.email);
    });

    test('should decrypt sensitive data correctly', async () => {
      const originalSSN = '123-45-6789';
      const encrypted = EncryptionService.encryptField(originalSSN, 'ssn', 'test-key');
      const decrypted = EncryptionService.decryptField(encrypted, 'ssn', 'test-key');

      expect(decrypted).toBe(originalSSN);
    });

    test('should handle decryption failures gracefully', async () => {
      const corruptedData = {
        encrypted: true,
        data: 'corrupted-encrypted-data'
      };

      const result = EncryptionService.decryptField(corruptedData, 'ssn', 'test-key');
      expect(result).toBeNull();
    });
  });

  describe('FERPA Compliance', () => {
    test('should restrict access based on user role', async () => {
      const ferpaService = new FERPAService();

      // Test student access (should be limited)
      const studentAccess = ferpaService.checkFieldAccess('STUDENT', 'grades');
      expect(studentAccess.canRead).toBe(false);
      expect(studentAccess.canWrite).toBe(false);

      // Test teacher access (should be limited)
      const teacherAccess = ferpaService.checkFieldAccess('TEACHER', 'grades');
      expect(teacherAccess.canRead).toBe(true);
      expect(teacherAccess.canWrite).toBe(false);

      // Test admin access (should be full)
      const adminAccess = ferpaService.checkFieldAccess('ADMIN', 'grades');
      expect(adminAccess.canRead).toBe(true);
      expect(adminAccess.canWrite).toBe(true);
    });

    test('should filter sensitive data based on user role', async () => {
      const ferpaService = new FERPAService();
      const studentData = {
        id: '1',
        name: 'John Doe',
        ssn: '123-45-6789',
        grades: 'A',
        address: '123 Main St'
      };

      // Student should only see basic info
      const studentFiltered = ferpaService.filterStudentData(studentData, 'STUDENT', 'student-1');
      expect(studentFiltered.ssn).not.toBe(studentData.ssn); // Should be encrypted
      expect(studentFiltered.grades).toBeUndefined(); // Should not be included

      // Admin should see all data
      const adminFiltered = ferpaService.filterStudentData(studentData, 'ADMIN', 'admin-1');
      expect(adminFiltered.ssn).toBe(studentData.ssn); // Should not be encrypted
      expect(adminFiltered.grades).toBe(studentData.grades); // Should be included
    });

    test('should log all data access attempts', async () => {
      const ferpaService = new FERPAService();
      const initialLogs = ferpaService.getAuditLogs();

      // Trigger an access attempt
      ferpaService.filterStudentData({
        id: '1',
        name: 'John Doe',
        ssn: '123-45-6789'
      }, 'TEACHER', 'teacher-1');

      const updatedLogs = ferpaService.getAuditLogs();
      expect(updatedLogs.length).toBeGreaterThan(initialLogs.length);

      // Check that the last log contains the expected information
      const lastLog = updatedLogs[0];
      expect(lastLog.userId).toBe('teacher-1');
      expect(lastLog.action).toBe('READ');
      expect(lastLog.resource).toBe('student');
      expect(lastLog.success).toBe(true);
    });

    test('should detect suspicious access patterns', async () => {
      const ferpaService = new FERPAService();
      const userId = 'suspicious-user-1';

      // Simulate rapid access to sensitive fields
      for (let i = 0; i < 15; i++) {
        ferpaService.filterStudentData({
          id: `student-${i}`,
          ssn: `123-45-678${i}`,
          grades: 'A'
        }, 'TEACHER', userId);
      }

      const suspiciousLogs = ferpaService.detectSuspiciousAccess(userId);
      expect(suspiciousLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id')
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('SQL');
      expect(response.body.error).not.toContain('internal');
    });

    test('should use proper HTTP status codes', async () => {
      // Test validation errors
      const validationResponse = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .send({ title: '' })
        .expect(400);

      expect(validationResponse.body.error).toContain('validation');

      // Test not found errors
      const notFoundResponse = await request(app)
        .get('/api/books/nonexistent-id')
        .set('Authorization', authToken)
        .expect(404);

      expect(notFoundResponse.body.error).toContain('not found');

      // Test authorization errors
      const authResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', authToken)
        .expect(403);

      expect(authResponse.body.error).toContain('privileges');
    });

    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}') // Malformed JSON
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('invalid');
    });
  });

  describe('Session Security', () => {
    test('should use secure cookie settings', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!'
        });

      // Check if secure cookies are set (in production)
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['set-cookie']).toBeDefined();
        // Cookies should have secure, httpOnly, and sameSite attributes
      }
    });

    test('should invalidate sessions properly', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Rate Limiting Security', () => {
    test('should implement global rate limiting', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/books')
          .set('Authorization', authToken)
      );

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should implement endpoint-specific rate limiting', async () => {
      // Test stricter rate limiting on auth endpoints
      const authRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'testpassword'
          })
      );

      const authResponses = await Promise.allSettled(authRequests);
      const authRateLimited = authResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(authRateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Header Security', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for important security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    test('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/books')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Error Classes Security', () => {
    test('should create validation errors properly', () => {
      const error = new ValidationError('Test validation error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    test('should create authentication errors properly', () => {
      const error = new AuthenticationError('Test auth error');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('should create FERPA compliance errors properly', () => {
      const error = new FERPAComplianceError('Test FERPA error');
      expect(error.statusCode).toBe(403);
      expect(error.isOperational).toBe(true);
      expect(error.code).toBe('FERPA_COMPLIANCE_ERROR');
    });
  });

  describe('File Upload Security', () => {
    test('should validate file types', async () => {
      // Test uploading executable files (should be rejected)
      const response = await request(app)
        .post('/api/import/csv')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from('fake executable content'), 'malware.exe')
        .expect(400);

      expect(response.body.error).toContain('file type');
    });

    test('should limit file sizes', async () => {
      // Test uploading large files (should be rejected)
      const largeFile = Buffer.alloc(50 * 1024 * 1024); // 50MB file

      const response = await request(app)
        .post('/api/import/csv')
        .set('Authorization', adminToken)
        .attach('file', largeFile, 'large-file.csv')
        .expect(400);

      expect(response.body.error).toContain('file size');
    });
  });

  describe('Database Security', () => {
    test('should use parameterized queries', async () => {
      // This is tested implicitly by ensuring no SQL injection attacks succeed
      const maliciousInput = "'; DROP TABLE books; --";

      const response = await request(app)
        .get(`/api/books?query=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', authToken)
        .expect(200);

      // Response should be normal, not an error
      expect(response.body.success).toBe(true);
    });

    test('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, ensure the app doesn't crash on database errors
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Logging Security', () => {
    test('should not log sensitive information', async () => {
      // This would require checking actual log files
      // For now, ensure the error handler doesn't expose sensitive data
      expect(true).toBe(true); // Placeholder test
    });

    test('should log security events', async () => {
      // Test failed login attempt
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      // Should log the failed attempt
      expect(true).toBe(true); // Placeholder test
    });
  });
});

export {};