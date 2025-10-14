import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Import routes and middleware
import authRoutes from '@/routes/auth';
import studentRoutes from '@/routes/students';
import bookRoutes from '@/routes/books';
import equipmentRoutes from '@/routes/equipment';
import { authMiddleware } from '@/middleware/auth';
import { errorHandler } from '@/middleware/errorMiddleware';
import { ferpaMiddleware } from '@/middleware/ferpa.middleware';
import { auditMiddleware } from '@/middleware/audit.middleware';

// Test utilities
import { TestDataFactory } from '../factories/TestDataFactory';
import { createTestPrisma } from '../setup-comprehensive';

describe('Security Testing - API Security', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    // Create Express app with security middleware
    app = express();

    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Rate limiting
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: { error: 'Too many requests' },
      standardHeaders: true,
      legacyHeaders: false,
    }));

    // CORS configuration
    app.use(cors({
      origin: ['http://localhost:3000', 'https://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Body parsing with limits
    app.use(express.json({
      limit: '10mb',
      verify: (req, res, buf) => {
        try {
          JSON.parse(buf.toString());
        } catch (e) {
          res.status(400).json({ error: 'Invalid JSON' });
          return;
        }
      }
    }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());
    app.use(compression());

    // Audit and FERPA middleware
    app.use(auditMiddleware);
    app.use('/api/students', ferpaMiddleware);

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/students', authMiddleware, studentRoutes);
    app.use('/api/books', authMiddleware, bookRoutes);
    app.use('/api/equipment', authMiddleware, equipmentRoutes);

    // Health check (no auth required)
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Error handling
    app.use(errorHandler);

    // Setup mock data
    const testStudents = TestDataFactory.createStudents(10);
    const testBooks = TestDataFactory.createBooks(20);
    const testEquipment = TestDataFactory.createEquipmentList(5);

    const mockPrisma = createTestPrisma();
    mockPrisma.students.findMany.mockResolvedValue(testStudents as any);
    mockPrisma.students.count.mockResolvedValue(testStudents.length);
    mockPrisma.students.findUnique.mockResolvedValue(testStudents[0] as any);
    mockPrisma.students.create.mockResolvedValue(testStudents[0] as any);
    mockPrisma.books.findMany.mockResolvedValue(testBooks as any);
    mockPrisma.books.count.mockResolvedValue(testBooks.length);
    mockPrisma.equipment.findMany.mockResolvedValue(testEquipment as any);
    mockPrisma.equipment.count.mockResolvedValue(testEquipment.length);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    TestDataFactory.resetCounter();
  });

  afterEach(() => {
    // Cleanup test state
  });

  describe('OWASP Top 10 Security Tests', () => {
    describe('A01: Broken Access Control', () => {
      it('should require authentication for protected endpoints', async () => {
        // Test without authentication
        await request(app)
          .get('/api/students')
          .expect(401);

        await request(app)
          .post('/api/students')
          .send({
            student_id: 'TEST001',
            first_name: 'Test',
            last_name: 'Student'
          })
          .expect(401);

        await request(app)
          .put('/api/students/1')
          .send({ first_name: 'Updated' })
          .expect(401);

        await request(app)
          .delete('/api/students/1')
          .expect(401);
      });

      it('should reject invalid JWT tokens', async () => {
        const invalidTokens = [
          'invalid.token',
          'Bearer invalid',
          '',
          'null',
          'undefined',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
          'too.many.parts.in.token'
        ];

        for (const token of invalidTokens) {
          await request(app)
            .get('/api/students')
            .set('Authorization', token)
            .expect(401);
        }
      });

      it('should prevent privilege escalation', async () => {
        // Mock student token (lower privileges)
        const studentToken = 'Bearer student-jwt-token';

        vi.mock('@/middleware/auth', () => ({
          authMiddleware: vi.fn().mockImplementation((req, res, next) => {
            req.user = {
              id: 'student-id',
              username: 'student',
              role: 'STUDENT'
            };
            next();
          })
        }));

        // Student trying to access admin-only endpoints should be blocked
        await request(app)
          .get('/api/users')
          .set('Authorization', studentToken)
          .expect(403);

        await request(app)
          .delete('/api/students/1')
          .set('Authorization', studentToken)
          .expect(403);
      });

      it('should enforce proper resource ownership', async () => {
        // Mock user accessing another user's resources
        vi.mock('@/middleware/auth', () => ({
          authMiddleware: vi.fn().mockImplementation((req, res, next) => {
            req.user = {
              id: 'user-1',
              username: 'user1',
              role: 'STUDENT'
            };
            next();
          })
        }));

        // Try to access another student's data
        await request(app)
          .get('/api/students/user-2') // Different user ID
          .set('Authorization', 'Bearer student-token')
          .expect(403);
      });
    });

    describe('A02: Cryptographic Failures', () => {
      it('should not transmit sensitive data in clear text', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'test',
            password: 'plaintext-password'
          })
          .expect(401); // Login should fail, but check that password isn't exposed

        // Password should not be in response
        expect(response.body.password).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('plaintext-password');
      });

      it('should use secure cookie settings', async () => {
        // Test cookie security headers
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'test',
            password: 'password'
          });

        if (response.headers['set-cookie']) {
          const cookies = Array.isArray(response.headers['set-cookie'])
            ? response.headers['set-cookie']
            : [response.headers['set-cookie']];

          cookies.forEach(cookie => {
            expect(cookie).toContain('HttpOnly');
            expect(cookie).toContain('Secure');
            expect(cookie).toContain('SameSite');
          });
        }
      });

      it('should not expose sensitive data in error messages', async () => {
        // Test database errors don't expose internal details
        vi.mock('@/utils/prisma', () => ({
          prisma: {
            students: {
              findMany: vi.fn().mockRejectedValue(new Error('Database connection string: mysql://user:pass@host/db'))
            }
          }
        }));

        const response = await request(app)
          .get('/api/students')
          .set('Authorization', 'Bearer valid-token')
          .expect(500);

        expect(response.body.message).not.toContain('mysql://');
        expect(response.body.message).not.toContain('password');
        expect(response.body.stack).toBeUndefined();
      });
    });

    describe('A03: Injection', () => {
      it('should prevent SQL injection in parameters', async () => {
        const sqlInjectionPayloads = [
          "'; DROP TABLE students; --",
          "' OR '1'='1",
          "1' UNION SELECT * FROM users --",
          "'; INSERT INTO users VALUES ('hacker', 'password'); --",
          "'; UPDATE students SET first_name='HACKED'; --"
        ];

        for (const payload of sqlInjectionPayloads) {
          const response = await request(app)
            .get(`/api/students/${encodeURIComponent(payload)}`)
            .set('Authorization', 'Bearer valid-token')
            .expect(404);

          // Should not reveal database structure
          expect(response.body.message).not.toContain('DROP TABLE');
          expect(response.body.message).not.toContain('syntax error');
        }
      });

      it('should sanitize NoSQL injection attempts', async () => {
        const noSqlPayloads = [
          { "$gt": "" },
          { "$ne": null },
          { "$where": "return true" },
          { "$regex": ".*" },
          { "$in": ["admin", "root"] }
        ];

        for (const payload of noSqlPayloads) {
          const response = await request(app)
            .post('/api/students/search')
            .send(payload)
            .set('Authorization', 'Bearer valid-token');

          // Should not accept suspicious query objects
          if (response.status !== 400) {
            expect(response.body).not.toContain(payload);
          }
        }
      });

      it('should handle XSS in input parameters', async () => {
        const xssPayloads = [
          "<script>alert('xss')</script>",
          "javascript:alert('xss')",
          "<img src=x onerror=alert('xss')>",
          "<svg onload=alert('xss')>",
          "'\"><script>alert('xss')</script>"
        ];

        for (const payload of xssPayloads) {
          const response = await request(app)
            .get(`/api/students/search?q=${encodeURIComponent(payload)}`)
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

          // Response should not contain executable scripts
          expect(response.text).not.toContain('<script>');
          expect(response.text).not.toContain('javascript:');
          expect(response.text).not.toContain('onerror=');
          expect(response.text).not.toContain('onload=');
        }
      });
    });

    describe('A04: Insecure Design', () {
      it('should implement proper rate limiting', async () => {
        const requests = [];

        // Make multiple rapid requests
        for (let i = 0; i < 10; i++) {
          requests.push(
            request(app)
              .post('/api/auth/login')
              .send({ username: 'test', password: 'wrong' })
          );
        }

        const responses = await Promise.all(requests);

        // Some requests should be rate limited
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });

      it('should validate input data structure', async () => {
        const invalidPayloads = [
          null,
          undefined,
          'string',
          123,
          [],
          { invalidField: 'value' },
          { student_id: 123 }, // Wrong type
          { first_name: '' }, // Empty string
          { first_name: 'a'.repeat(1000) } // Too long
        ];

        for (const payload of invalidPayloads) {
          const response = await request(app)
            .post('/api/students')
            .send(payload)
            .set('Authorization', 'Bearer valid-token');

          expect([400, 422]).toContain(response.status);
        }
      });

      it('should enforce business rules consistently', async () => {
        // Test duplicate student ID prevention
        const existingStudent = TestDataFactory.createStudent({ student_id: 'DUPLICATE001' });

        vi.mock('@/utils/prisma', () => ({
          prisma: {
            students: {
              findUnique: vi.fn().mockResolvedValue(existingStudent as any),
              create: vi.fn().mockRejectedValue(new Error('Unique constraint failed'))
            }
          }
        }));

        const response = await request(app)
          .post('/api/students')
          .send({
            student_id: 'DUPLICATE001',
            first_name: 'Another',
            last_name: 'Student'
          })
          .set('Authorization', 'Bearer valid-token')
          .expect(400);

        expect(response.body.message).toContain('already exists');
      });
    });

    describe('A05: Security Misconfiguration', () => {
      it('should not expose sensitive information in headers', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        // Check for security headers
        expect(response.headers['x-powered-by']).toBeUndefined();
        expect(response.headers['server']).toBeUndefined();
        expect(response.headers['x-aspnet-version']).toBeUndefined();
        expect(response.headers['x-php-version']).toBeUndefined();

        // Should have security headers
        expect(response.headers['x-frame-options']).toBeDefined();
        expect(response.headers['x-content-type-options']).toBeDefined();
        expect(response.headers['x-xss-protection']).toBeDefined();
        expect(response.headers['strict-transport-security']).toBeDefined();
        expect(response.headers['content-security-policy']).toBeDefined();
      });

      it('should handle HTTP methods correctly', async () => {
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
        const disallowedMethods = ['PATCH', 'OPTIONS', 'HEAD', 'TRACE', 'CONNECT'];

        // Test OPTIONS for CORS preflight
        await request(app)
          .options('/api/students')
          .expect(200);

        // Test disallowed methods
        for (const method of disallowedMethods) {
          await request(app)
            [method.toLowerCase() as 'patch']('/api/students')
            .expect(405);
        }
      });

      it('should implement proper CORS configuration', async () => {
        // Test allowed origin
        await request(app)
          .get('/api/students')
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', 'Bearer valid-token')
          .expect(401); // Auth fails, but CORS headers should be present

        // Test disallowed origin
        const response = await request(app)
          .get('/api/students')
          .set('Origin', 'http://malicious-site.com')
          .set('Authorization', 'Bearer valid-token')
          .expect(401);

        // Should not have Access-Control-Allow-Origin for malicious origin
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      });

      it('should not leak information in error responses', async () => {
        // Test various error conditions
        const errorTests = [
          { path: '/api/nonexistent', expected: 404 },
          { path: '/api/students/invalid-id', expected: 404 },
          {
            path: '/api/students',
            method: 'POST',
            body: { invalid: 'data' },
            expected: 400
          }
        ];

        for (const test of errorTests) {
          const response = test.method
            ? await request(app)[test.method.toLowerCase() as 'post'](test.path).send(test.body)
            : await request(app).get(test.path);

          expect(response.status).toBe(test.expected);
          expect(response.body.stack).toBeUndefined();
          expect(response.body.internalError).toBeUndefined();
          expect(JSON.stringify(response.body)).not.toContain(process.cwd());
          expect(JSON.stringify(response.body)).not.toContain(__dirname);
        }
      });
    });

    describe('A06: Vulnerable and Outdated Components', () => {
      it('should not use vulnerable dependencies', async () => {
        // This would typically be handled by dependency scanning tools
        // For testing purposes, we verify that known vulnerable patterns aren't used

        const response = await request(app)
          .get('/health')
          .expect(200);

        // Check that we're not exposing version information
        expect(response.text).not.toMatch(/express/i);
        expect(response.text).not.toMatch(/node/i);
        expect(response.text).not.toMatch(/npm/i);
      });

      it('should handle file upload security', async () => {
        const maliciousFiles = [
          { name: 'malware.exe', type: 'application/octet-stream' },
          { name: 'script.php', type: 'application/x-php' },
          { name: 'exploit.js', type: 'application/javascript' }
        ];

        for (const file of maliciousFiles) {
          const response = await request(app)
            .post('/api/students/import')
            .attach('file', Buffer.from('fake content'), file.name)
            .set('Authorization', 'Bearer valid-token')
            .expect(400);

          expect(response.body.message).toContain('not allowed');
        }
      });
    });

    describe('A07: Identification and Authentication Failures', () => {
      it('should implement proper password policies', async () => {
        const weakPasswords = [
          '123456',
          'password',
          'admin',
          'qwerty',
          '111111',
          'abc123'
        ];

        for (const password of weakPasswords) {
          const response = await request(app)
            .post('/api/auth/register')
            .send({
              username: 'testuser',
              password: password,
              email: 'test@example.com'
            })
            .expect(400);

          expect(response.body.message).toContain('password');
        }
      });

      it('should implement account lockout after failed attempts', async () => {
        const maxAttempts = 5;

        // Make multiple failed login attempts
        for (let i = 0; i < maxAttempts + 1; i++) {
          const response = await request(app)
            .post('/api/auth/login')
            .send({
              username: 'testuser',
              password: 'wrongpassword'
            });

          if (i < maxAttempts) {
            expect(response.status).toBe(401);
          } else {
            // Should be locked out
            expect([401, 423]).toContain(response.status);
          }
        }
      });

      it('should handle session management securely', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'correctpassword'
          })
          .expect(200);

        // Should receive secure session token
        expect(response.body.token).toBeDefined();
        expect(typeof response.body.token).toBe('string');
        expect(response.body.token.length).toBeGreaterThan(20);

        // Token should not contain sensitive information
        expect(response.body.token).not.toContain('password');
      });
    });

    describe('A08: Software and Data Integrity Failures', () => {
      it('should validate file integrity for uploads', async () => {
        // Test file with wrong extension
        const response = await request(app)
          .post('/api/students/import')
          .attach('file', Buffer.from('content'), 'malicious.exe')
          .set('Authorization', 'Bearer valid-token')
          .expect(400);

        expect(response.body.message).toContain('Only CSV files');
      });

      it('should verify data integrity in requests', async () => {
        // Test tampered data
        const validStudent = {
          student_id: 'VALID001',
          first_name: 'Valid',
          last_name: 'Student',
          checksum: 'invalid-checksum' // Tampered
        };

        const response = await request(app)
          .post('/api/students')
          .send(validStudent)
          .set('Authorization', 'Bearer valid-token')
          .expect(400);

        expect(response.body.message).toContain('checksum');
      });
    });

    describe('A09: Security Logging and Monitoring Failures', () => {
      it('should log security events', async () => {
        // Mock audit logger
        const mockLogger = vi.fn();
        vi.mock('@/utils/logger', () => ({
          logger: {
            warn: mockLogger,
            error: mockLogger,
            info: mockLogger
          }
        }));

        // Trigger security events
        await request(app)
          .post('/api/auth/login')
          .send({ username: 'admin', password: 'wrong' });

        await request(app)
          .get('/api/students')
          .set('Authorization', 'Bearer invalid-token');

        await request(app)
          .post('/api/students')
          .send({ invalid: 'data' })
          .set('Authorization', 'Bearer valid-token');

        // Verify logging occurred
        expect(mockLogger).toHaveBeenCalled();
      });

      it('should provide audit trail for sensitive operations', async () => {
        // Test that sensitive operations are logged
        const sensitiveOperations = [
          { method: 'POST', path: '/api/students', body: TestDataFactory.createStudent() },
          { method: 'PUT', path: '/api/students/1', body: { first_name: 'Updated' } },
          { method: 'DELETE', path: '/api/students/1' }
        ];

        const mockAudit = vi.fn();
        vi.mock('@/middleware/audit.middleware', () => ({
          auditMiddleware: vi.fn().mockImplementation((req, res, next) => {
            mockAudit({
              method: req.method,
              path: req.path,
              user: req.user,
              body: req.body,
              ip: req.ip,
              userAgent: req.get('User-Agent')
            });
            next();
          })
        }));

        for (const operation of sensitiveOperations) {
          await request(app)
            [operation.method.toLowerCase() as 'post'](operation.path)
            .send(operation.body)
            .set('Authorization', 'Bearer valid-token');

          expect(mockAudit).toHaveBeenCalledWith(
            expect.objectContaining({
              method: operation.method,
              path: operation.path
            })
          );
        }
      });
    });

    describe('A10: Server-Side Request Forgery (SSRF)', () => {
      it('should prevent SSRF attacks', async () => {
        const ssrfPayloads = [
          'http://localhost:8080/admin',
          'http://127.0.0.1:22',
          'http://169.254.169.254/latest/meta-data/', // AWS metadata
          'file:///etc/passwd',
          'ftp://malicious-server.com/file',
          'gopher://malicious-server.com:70/_payload'
        ];

        for (const payload of ssrfPayloads) {
          const response = await request(app)
            .post('/api/proxy') // Assuming there's a proxy endpoint
            .send({ url: payload })
            .set('Authorization', 'Bearer valid-token')
            .expect(404); // Should not exist or be blocked
        }
      });

      it('should validate external URLs', async () => {
        const suspiciousUrls = [
          'http://internal.company.com/secrets',
          'https://admin.localhost:3000',
          'http://0.0.0.0:8080',
          'http://192.168.1.1:3000'
        ];

        for (const url of suspiciousUrls) {
          const response = await request(app)
            .post('/api/external-data')
            .send({ url })
            .set('Authorization', 'Bearer valid-token')
            .expect(400);

          expect(response.body.message).toContain('URL');
        }
      });
    });
  });

  describe('Additional Security Tests', () => {
    it('should implement FERPA compliance for student data', async () => {
      const testStudent = TestDataFactory.createStudent({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@school.edu',
        ssn: '123-45-6789' // Sensitive PII
      });

      // Ensure sensitive fields are not exposed
      const response = await request(app)
        .get(`/api/students/${testStudent.id}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.ssn).toBeUndefined();
      expect(response.body.email).toBeUndefined(); // Unless authorized
      expect(response.body.guardian_contact).toBeUndefined(); // Unless authorized
    });

    it('should implement proper data encryption', async () => {
      // Test that sensitive data is encrypted at rest
      const sensitiveData = {
        student_id: 'SENSITIVE001',
        first_name: 'Test',
        ssn: '123-45-6789', // Should be encrypted
        medical_info: 'Sensitive medical information' // Should be encrypted
      };

      const response = await request(app)
        .post('/api/students')
        .send(sensitiveData)
        .set('Authorization', 'Bearer admin-token')
        .expect(201);

      // Sensitive fields should not be returned in plain text
      expect(response.body.ssn).toBeUndefined();
      expect(response.body.medical_info).toBeUndefined();
    });

    it('should handle concurrent requests safely', async () => {
      const concurrentRequests = Array.from({ length: 100 }, (_, i) =>
        request(app)
          .get('/api/students')
          .set('Authorization', 'Bearer valid-token')
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed without errors
      responses.forEach(response => {
        expect([200, 401]).toContain(response.status);
      });

      // No race conditions should occur
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('should prevent information disclosure through error messages', async () => {
      // Test various error scenarios
      const errorScenarios = [
        {
          test: () => request(app).get('/api/students/nonexistent'),
          check: (res: any) => !res.body.message.includes('prisma')
        },
        {
          test: () => request(app).post('/api/students').send({}),
          check: (res: any) => !res.body.message.includes('database')
        },
        {
          test: () => request(app).put('/api/students/invalid-id').send({}),
          check: (res: any) => !res.body.message.includes('SQL')
        }
      ];

      for (const scenario of errorScenarios) {
        const response = await scenario.test();
        expect(scenario.check(response)).toBe(true);
      }
    });
  });
});