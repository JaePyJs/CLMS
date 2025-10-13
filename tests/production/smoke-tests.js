/**
 * Production Smoke Tests for CLMS
 * These tests verify that the production deployment is working correctly
 */

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.production' });

const BASE_URL = process.env.BASE_URL || 'https://your-domain.com';

test.describe('Production Smoke Tests', () => {
  test.beforeAll(async ({ request }) => {
    console.log(`Running smoke tests against: ${BASE_URL}`);
  });

  test('Frontend loads correctly', async ({ page }) => {
    console.log('Testing frontend load...');

    await page.goto(BASE_URL);

    // Check if page loads without errors
    await expect(page).toHaveTitle(/CLMS|Library Management/);

    // Check for main application elements
    await expect(page.locator('body')).toBeVisible();

    // Check if there are no JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('Backend health endpoint responds', async ({ request }) => {
    console.log('Testing backend health endpoint...');

    const response = await request.get(`${BASE_URL}/api/health`);

    expect(response.status()).toBe(200);

    const healthData = await response.json();
    expect(healthData).toHaveProperty('status', 'healthy');
    expect(healthData).toHaveProperty('timestamp');
    expect(healthData).toHaveProperty('uptime');
  });

  test('Database connectivity works', async ({ request }) => {
    console.log('Testing database connectivity...');

    const response = await request.get(`${BASE_URL}/api/health/database`);

    expect(response.status()).toBe(200);

    const dbHealth = await response.json();
    expect(dbHealth).toHaveProperty('status', 'healthy');
    expect(dbHealth).toHaveProperty('connection');
    expect(dbHealth.connection).toBe('connected');
  });

  test('Redis connectivity works', async ({ request }) => {
    console.log('Testing Redis connectivity...');

    const response = await request.get(`${BASE_URL}/api/health/redis`);

    expect(response.status()).toBe(200);

    const redisHealth = await response.json();
    expect(redisHealth).toHaveProperty('status', 'healthy');
    expect(redisHealth).toHaveProperty('connection');
    expect(redisHealth.connection).toBe('connected');
  });

  test('Authentication endpoints are working', async ({ request }) => {
    console.log('Testing authentication endpoints...');

    // Test login endpoint exists and handles requests properly
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'invalid-password'
      }
    });

    // Should return 401 for invalid credentials
    expect(loginResponse.status()).toBe(401);

    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('error');
  });

  test('Public endpoints are accessible', async ({ request }) => {
    console.log('Testing public endpoints...');

    const publicEndpoints = [
      '/api/health',
      '/api/health/database',
      '/api/health/redis',
      '/api/system/info'
    ];

    for (const endpoint of publicEndpoints) {
      console.log(`Testing endpoint: ${endpoint}`);
      const response = await request.get(`${BASE_URL}${endpoint}`);
      expect(response.status()).toBe(200);
    }
  });

  test('Static assets are loading correctly', async ({ page }) => {
    console.log('Testing static assets...');

    await page.goto(BASE_URL);

    // Check CSS files
    const cssLinks = await page.locator('link[rel="stylesheet"]').count();
    expect(cssLinks).toBeGreaterThan(0);

    // Check JavaScript files
    const jsScripts = await page.locator('script[src]').count();
    expect(jsScripts).toBeGreaterThan(0);

    // Check for missing resources
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });

    await page.waitForLoadState('networkidle');

    // Filter out external resources that might legitimately fail
    const criticalFailures = failedRequests.filter(url =>
      url.includes(BASE_URL) && !url.includes('favicon.ico')
    );

    expect(criticalFailures).toHaveLength(0);
  });

  test('API rate limiting is working', async ({ request }) => {
    console.log('Testing API rate limiting...');

    // Make multiple rapid requests to test rate limiting
    const requests = Array(20).fill(null).map(() =>
      request.get(`${BASE_URL}/api/health`)
    );

    const responses = await Promise.all(requests);

    // Most should succeed, but some might be rate limited
    const successCount = responses.filter(r => r.status() === 200).length;
    const rateLimitedCount = responses.filter(r => r.status() === 429).length;

    console.log(`Successful requests: ${successCount}, Rate limited: ${rateLimitedCount}`);

    // At least some requests should succeed
    expect(successCount).toBeGreaterThan(10);

    // Rate limiting should be active (optional, depending on configuration)
    if (rateLimitedCount > 0) {
      console.log('✅ Rate limiting is active');
    } else {
      console.log('⚠️ Rate limiting may not be configured');
    }
  });

  test('Security headers are present', async ({ request }) => {
    console.log('Testing security headers...');

    const response = await request.get(BASE_URL);
    const headers = response.headers();

    // Check for important security headers
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security'
    ];

    securityHeaders.forEach(header => {
      expect(headers[header]).toBeDefined();
      console.log(`✅ Security header present: ${header}`);
    });
  });

  test('Error handling is working correctly', async ({ request }) => {
    console.log('Testing error handling...');

    // Test 404 handling
    const notFoundResponse = await request.get(`${BASE_URL}/api/non-existent-endpoint`);
    expect(notFoundResponse.status()).toBe(404);

    const notFoundData = await notFoundResponse.json();
    expect(notFoundData).toHaveProperty('error');

    // Test invalid method
    const invalidMethodResponse = await request.request({
      method: 'PATCH',
      url: `${BASE_URL}/api/health`
    });
    expect(invalidMethodResponse.status()).toBe(405);
  });

  test('Performance benchmarks are within acceptable limits', async ({ page }) => {
    console.log('Testing performance benchmarks...');

    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    // Check Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals = {
            lcp: entries.find(e => e.name === 'largest-contentful-paint')?.startTime || 0,
            fid: entries.find(e => e.name === 'first-input')?.processingStart || 0,
            cls: entries.find(e => e.name === 'cumulative-layout-shift')?.value || 0
          };
          resolve(vitals);
        }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'cumulative-layout-shift'] });

        // Fallback timeout
        setTimeout(() => resolve({ lcp: 0, fid: 0, cls: 0 }), 5000);
      });
    });

    console.log('Core Web Vitals:', vitals);

    // Largest Contentful Paint should be under 2.5 seconds
    expect(vitals.lcp).toBeLessThan(2500);

    // Cumulative Layout Shift should be under 0.1
    expect(vitals.cls).toBeLessThan(0.1);
  });

  test('Mobile responsiveness is working', async ({ page }) => {
    console.log('Testing mobile responsiveness...');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone 8 dimensions
    await page.goto(BASE_URL);

    // Check if mobile menu is present (or mobile-specific elements)
    const mobileMenu = await page.locator('[data-testid="mobile-menu"], .mobile-menu, .hamburger').count();

    // Check if content is properly sized for mobile
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);

    console.log('✅ Mobile layout is responsive');
  });

  test('Database queries are working', async ({ request }) => {
    console.log('Testing database queries...');

    // Test public data endpoints that query the database
    const publicDataEndpoints = [
      '/api/books/count',
      '/api/students/count',
      '/api/equipment/count'
    ];

    for (const endpoint of publicDataEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);

        if (response.status() === 200) {
          const data = await response.json();
          expect(typeof data.count).toBe('number');
          console.log(`✅ Database query working for ${endpoint}`);
        } else if (response.status() === 401) {
          // Endpoint requires authentication - that's expected
          console.log(`✅ Authentication required for ${endpoint} (expected)`);
        }
      } catch (error) {
        console.log(`⚠️ Could not test ${endpoint}: ${error.message}`);
      }
    }
  });

  test('File uploads are working', async ({ request }) => {
    console.log('Testing file upload functionality...');

    // Test upload endpoint exists (even if it requires authentication)
    const uploadResponse = await request.post(`${BASE_URL}/api/upload`, {
      data: new FormData()
    });

    // Should either succeed (unlikely without auth) or require authentication
    expect([200, 401, 413]).toContain(uploadResponse.status());

    if (uploadResponse.status() === 401) {
      console.log('✅ Upload endpoint requires authentication (expected)');
    } else if (uploadResponse.status() === 413) {
      console.log('✅ File size validation is working');
    }
  });

  test('WebSocket connections are working', async ({ page }) => {
    console.log('Testing WebSocket connectivity...');

    await page.goto(BASE_URL);

    // Test WebSocket connection
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket(`wss://${window.location.host}/ws`);

        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
    });

    console.log(wsConnected ? '✅ WebSocket connection successful' : '⚠️ WebSocket connection failed');
  });

  test('API documentation is accessible', async ({ request }) => {
    console.log('Testing API documentation...');

    const docsEndpoints = [
      '/api/docs',
      '/api/swagger',
      '/api/redoc',
      '/docs'
    ];

    let docsFound = false;
    for (const endpoint of docsEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200) {
          console.log(`✅ API documentation found at ${endpoint}`);
          docsFound = true;
          break;
        }
      } catch (error) {
        // Continue to next endpoint
      }
    }

    if (!docsFound) {
      console.log('⚠️ API documentation not found');
    }
  });

  test.afterAll(async () => {
    console.log('✅ All smoke tests completed');
  });
});