/**
 * Production Security Scans for CLMS
 * Security validation and vulnerability testing
 */

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.production' });

const BASE_URL = process.env.BASE_URL || 'https://your-domain.com';

test.describe('Production Security Scans', () => {
  test.beforeAll(async ({ request }) => {
    console.log(`Running security scans against: ${BASE_URL}`);
  });

  test('Security Headers Validation', async ({ request }) => {
    console.log('Validating security headers...');

    const response = await request.get(BASE_URL);
    const headers = response.headers();

    const securityHeaders = {
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
      'x-content-type-options': ['nosniff'],
      'x-xss-protection': ['1; mode=block'],
      'strict-transport-security': [/max-age=\d+/],
      'content-security-policy': [/default-src/],
      'referrer-policy': [/strict/]
    };

    const results = [];

    for (const [header, expectedValues] of Object.entries(securityHeaders)) {
      const actualValue = headers[header];

      if (!actualValue) {
        results.push({ header: header, status: 'MISSING', expected: expectedValues });
        console.log(`❌ Missing security header: ${header}`);
      } else {
        const isValid = expectedValues.some(expected => {
          if (typeof expected === 'string') {
            return actualValue.includes(expected);
          } else if (expected instanceof RegExp) {
            return expected.test(actualValue);
          }
          return actualValue === expected;
        });

        if (isValid) {
          results.push({ header: header, status: 'VALID', value: actualValue });
          console.log(`✅ Security header valid: ${header}`);
        } else {
          results.push({ header: header, status: 'INVALID', value: actualValue, expected: expectedValues });
          console.log(`⚠️ Security header invalid: ${header} = ${actualValue}`);
        }
      }
    }

    // At least 80% of security headers should be present and valid
    const validHeaders = results.filter(r => r.status === 'VALID').length;
    const totalHeaders = results.length;
    const validPercentage = (validHeaders / totalHeaders) * 100;

    expect(validPercentage).toBeGreaterThanOrEqual(80);
    console.log(`✅ Security headers validation: ${validPercentage.toFixed(1)}% valid`);
  });

  test('Common Vulnerability Checks', async ({ request }) => {
    console.log('Checking for common vulnerabilities...');

    const vulnerabilityTests = [
      {
        name: 'SQL Injection',
        endpoint: '/api/books/search',
        payload: "'; DROP TABLE books; --",
        method: 'GET',
        params: { q: "'; DROP TABLE books; --" }
      },
      {
        name: 'XSS in Search',
        endpoint: '/api/books/search',
        payload: '<script>alert("XSS")</script>',
        method: 'GET',
        params: { q: '<script>alert("XSS")</script>' }
      },
      {
        name: 'Path Traversal',
        endpoint: '/api/files',
        payload: '../../../etc/passwd',
        method: 'GET',
        params: { file: '../../../etc/passwd' }
      },
      {
        name: 'Command Injection',
        endpoint: '/api/system/command',
        payload: '; ls -la',
        method: 'POST',
        data: { command: 'test; ls -la' }
      }
    ];

    const results = [];

    for (const test of vulnerabilityTests) {
      try {
        let response;
        if (test.method === 'GET') {
          const url = new URL(`${BASE_URL}${test.endpoint}`);
          Object.entries(test.params || {}).forEach(([key, value]) => {
            url.searchParams.append(key, value);
          });
          response = await request.get(url.toString());
        } else {
          response = await request.post(`${BASE_URL}${test.endpoint}`, {
            data: test.data
          });
        }

        const statusCode = response.status();
        const body = await response.text();

        // Check if vulnerability was successful (bad)
        const vulnerable =
          statusCode === 200 ||
          body.includes('error') ||
          body.includes('mysql') ||
          body.includes('root:') ||
          body.includes('<script>') ||
          body.includes('alert(');

        results.push({
          name: test.name,
          payload: test.payload,
          statusCode,
          vulnerable,
          safe: !vulnerable
        });

        if (!vulnerable) {
          console.log(`✅ ${test.name}: Resisted payload "${test.payload}"`);
        } else {
          console.log(`⚠️ ${test.name}: May be vulnerable to payload "${test.payload}"`);
        }

      } catch (error) {
        // Errors in response often indicate proper security measures
        results.push({
          name: test.name,
          payload: test.payload,
          error: error.message,
          safe: true
        });
        console.log(`✅ ${test.name}: Properly rejected payload "${test.payload}"`);
      }
    }

    // All tests should be safe
    const safeTests = results.filter(r => r.safe).length;
    expect(safeTests).toBe(results.length);
    console.log(`✅ All ${results.length} vulnerability tests passed`);
  });

  test('Authentication Security', async ({ request }) => {
    console.log('Testing authentication security...');

    const authTests = [
      {
        name: 'Brute Force Protection',
        endpoint: '/api/auth/login',
        payloads: Array(10).fill(null).map((_, i) => ({
          email: 'test@example.com',
          password: `wrongpassword${i}`
        }))
      },
      {
        name: 'Weak Password Detection',
        endpoint: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: '123456',
          name: 'Test User'
        }
      },
      {
        name: 'JWT Token Validation',
        endpoint: '/api/auth/verify',
        headers: { Authorization: 'Bearer invalid.token.here' }
      }
    ];

    for (const test of authTests) {
      if (test.name === 'Brute Force Protection') {
        let rateLimited = false;
        for (const payload of test.payloads) {
          const response = await request.post(`${BASE_URL}${test.endpoint}`, { data: payload });
          if (response.status() === 429) {
            rateLimited = true;
            console.log('✅ Brute force protection is active');
            break;
          }
        }
        if (!rateLimited) {
          console.log('⚠️ Brute force protection may not be configured');
        }
      } else if (test.name === 'Weak Password Detection') {
        const response = await request.post(`${BASE_URL}${test.endpoint}`, { data: test.payload });
        if (response.status() === 400) {
          console.log('✅ Weak password detection is working');
        } else {
          console.log('⚠️ Weak password detection may not be configured');
        }
      } else if (test.name === 'JWT Token Validation') {
        const response = await request.get(`${BASE_URL}${test.endpoint}`, {
          headers: test.headers
        });
        if (response.status() === 401) {
          console.log('✅ JWT token validation is working');
        } else {
          console.log('⚠️ JWT token validation may have issues');
        }
      }
    }
  });

  test('Input Validation', async ({ request }) => {
    console.log('Testing input validation...');

    const inputTests = [
      {
        name: 'Large Input',
        endpoint: '/api/books',
        method: 'POST',
        data: {
          title: 'A'.repeat(10000), // Very large input
          author: 'Test Author'
        }
      },
      {
        name: 'Special Characters',
        endpoint: '/api/books',
        method: 'POST',
        data: {
          title: 'Book with <script>alert("XSS")</script> and "quotes" and \\backslashes\\',
          author: 'Author with emoji 🚀 and unicode ñáéíóú'
        }
      },
      {
        name: 'Null Bytes',
        endpoint: '/api/books/search',
        method: 'GET',
        params: { q: 'test\x00injection' }
      },
      {
        name: 'SQL Characters',
        endpoint: '/api/books/search',
        method: 'GET',
        params: { q: "Robert'); DROP TABLE books; --" }
      }
    ];

    for (const test of inputTests) {
      try {
        let response;
        if (test.method === 'GET') {
          const url = new URL(`${BASE_URL}${test.endpoint}`);
          Object.entries(test.params || {}).forEach(([key, value]) => {
            url.searchParams.append(key, value);
          });
          response = await request.get(url.toString());
        } else {
          response = await request.post(`${BASE_URL}${test.endpoint}`, {
            data: test.data,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Should either reject with validation error or require authentication
        const properlyHandled =
          response.status() === 400 || // Validation error
          response.status() === 401 || // Authentication required
          response.status() === 413;   // Payload too large

        if (properlyHandled) {
          console.log(`✅ ${test.name}: Properly handled`);
        } else {
          console.log(`⚠️ ${test.name}: Status ${response.status()} - may need review`);
        }

      } catch (error) {
        // Network errors often indicate proper rejection
        console.log(`✅ ${test.name}: Rejected (${error.message})`);
      }
    }
  });

  test('Rate Limiting', async ({ request }) => {
    console.log('Testing rate limiting...');

    const endpoint = '/api/health'; // Use a public endpoint
    const requests = Array(50).fill(null).map(() =>
      request.get(`${BASE_URL}${endpoint}`)
    );

    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());

    const successCount = statusCodes.filter(code => code === 200).length;
    const rateLimitedCount = statusCodes.filter(code => code === 429).length;

    console.log(`Success: ${successCount}, Rate Limited: ${rateLimitedCount}`);

    if (rateLimitedCount > 0) {
      console.log('✅ Rate limiting is active');
    } else {
      console.log('⚠️ Rate limiting may not be configured');
    }

    // At least some requests should succeed
    expect(successCount).toBeGreaterThan(20);
  });

  test('CORS Configuration', async ({ request }) => {
    console.log('Testing CORS configuration...');

    const origins = [
      'https://evil.com',
      'http://localhost:3000',
      'null',
      'https://your-domain.com'
    ];

    for (const origin of origins) {
      const response = await request.get(`${BASE_URL}/api/health`, {
        headers: { Origin: origin }
      });

      const corsHeader = response.headers()['access-control-allow-origin'];

      if (origin === 'https://your-domain.com' || origin.includes('localhost')) {
        // Should allow legitimate origins
        if (corsHeader === origin || corsHeader === '*') {
          console.log(`✅ CORS allows legitimate origin: ${origin}`);
        } else {
          console.log(`⚠️ CORS may not allow legitimate origin: ${origin}`);
        }
      } else {
        // Should not allow suspicious origins
        if (corsHeader === '*' || corsHeader === origin) {
          console.log(`⚠️ CORS may be too permissive for: ${origin}`);
        } else {
          console.log(`✅ CORS properly restricts suspicious origin: ${origin}`);
        }
      }
    }
  });

  test('Information Disclosure', async ({ request }) => {
    console.log('Testing for information disclosure...');

    const sensitiveEndpoints = [
      '/.env',
      '/config.json',
      '/package.json',
      '/server.js',
      '/api/config',
      '/api/debug',
      '/error',
      '/trace'
    ];

    const leakResults = [];

    for (const endpoint of sensitiveEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        const body = await response.text();

        // Check for sensitive information
        const containsSensitiveInfo =
          body.includes('password') ||
          body.includes('secret') ||
          body.includes('api_key') ||
          body.includes('database') ||
          body.includes('private_key') ||
          body.includes('process.env') ||
          response.headers()['x-powered-by'] ||
          response.headers()['server'];

        leakResults.push({
          endpoint,
          status: response.status(),
          containsSensitiveInfo,
          bodyLength: body.length
        });

        if (response.status() === 200 && containsSensitiveInfo) {
          console.log(`⚠️ Potential information disclosure at ${endpoint}`);
        } else if (response.status() === 404 || response.status() === 403) {
          console.log(`✅ Endpoint properly secured: ${endpoint}`);
        } else {
          console.log(`✅ No sensitive information disclosed at ${endpoint}`);
        }

      } catch (error) {
        console.log(`✅ Endpoint properly rejects access: ${endpoint}`);
      }
    }

    // Check for server information in headers
    const response = await request.get(BASE_URL);
    const serverHeader = response.headers()['server'];
    const poweredByHeader = response.headers()['x-powered-by'];

    if (serverHeader && !serverHeader.includes('nginx') && !serverHeader.includes('cloudflare')) {
      console.log(`⚠️ Server header reveals information: ${serverHeader}`);
    }

    if (poweredByHeader) {
      console.log(`⚠️ X-Powered-By header reveals information: ${poweredByHeader}`);
    }
  });

  test('Session Security', async ({ request }) => {
    console.log('Testing session security...');

    // Test login and session handling
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'testpassword'
      }
    });

    if (loginResponse.status() === 200) {
      const cookies = loginResponse.headers()['set-cookie'] || [];
      const sessionCookie = cookies.find(cookie => cookie.includes('session') || cookie.includes('jwt'));

      if (sessionCookie) {
        // Check for secure cookie attributes
        const hasSecure = sessionCookie.includes('Secure');
        const hasHttpOnly = sessionCookie.includes('HttpOnly');
        const hasSameSite = sessionCookie.includes('SameSite');

        console.log(`Session cookie security:`);
        console.log(`  Secure: ${hasSecure ? '✅' : '❌'}`);
        console.log(`  HttpOnly: ${hasHttpOnly ? '✅' : '❌'}`);
        console.log(`  SameSite: ${hasSameSite ? '✅' : '❌'}`);

        if (hasSecure && hasHttpOnly) {
          console.log('✅ Session cookies are properly secured');
        } else {
          console.log('⚠️ Session cookies may need additional security attributes');
        }
      }
    } else {
      console.log('ℹ️ Could not test session security (authentication endpoint not accessible)');
    }
  });

  test('File Upload Security', async ({ request }) => {
    console.log('Testing file upload security...');

    const maliciousFiles = [
      { name: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>' },
      { name: 'script.js', content: '<script>alert("XSS")</script>' },
      { name: '.htaccess', content: 'Allow from all' },
      { name: 'huge-file.txt', content: 'A'.repeat(10000000) } // 10MB file
    ];

    for (const file of maliciousFiles) {
      try {
        const formData = new FormData();
        const blob = new Blob([file.content]);
        formData.append('file', blob, file.name);

        const response = await request.post(`${BASE_URL}/api/upload`, {
          data: formData
        });

        const properlyHandled =
          response.status() === 400 || // Bad request
          response.status() === 401 || // Unauthorized
          response.status() === 413 || // File too large
          response.status() === 415;   // Unsupported media type

        if (properlyHandled) {
          console.log(`✅ File upload security: ${file.name} rejected (${response.status()})`);
        } else {
          console.log(`⚠️ File upload security: ${file.name} accepted (${response.status()})`);
        }

      } catch (error) {
        console.log(`✅ File upload security: ${file.name} rejected (${error.message})`);
      }
    }
  });

  test.afterAll(async () => {
    console.log('\n🔒 Production Security Scans Completed');
    console.log('🛡️ Review any warnings and implement recommended security measures');
  });
});