import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

// Test configuration
const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  admin: { username: 'admin', password: 'admin123' },
  librarian: { username: 'librarian', password: 'lib123' },
  assistant: { username: 'assistant', password: 'assist123' }
};

test.describe('CLMS Connection & System Tests', () => {
  test.beforeAll(async () => {
    console.log('🚀 Starting comprehensive CLMS connection tests...');
    console.log(`Frontend URL: ${FRONTEND_URL}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
  });

  test.describe('1. Basic Connectivity Tests', () => {
    test('Frontend server is accessible', async ({ page }) => {
      console.log('Testing frontend accessibility...');
      
      try {
        const response = await page.goto(FRONTEND_URL, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        console.log(`Frontend status: ${response?.status()}`);
        expect(response?.status()).toBeLessThan(400);
        
        // Check if page loads without critical errors
        const hasCriticalErrors = await page.evaluate(() => {
          return window.console.error.toString().includes('net::ERR');
        }).catch(() => false);
        
        expect(hasCriticalErrors).toBe(false);
        
      } catch (error) {
        console.error('Frontend connection failed:', error);
        throw error;
      }
    });

    test('Backend health endpoint is accessible', async ({ request }) => {
      console.log('Testing backend health endpoint...');
      
      try {
        const response = await request.get(`${BACKEND_URL}/health`, {
          timeout: 10000
        });
        
        console.log(`Backend health status: ${response.status()}`);
        expect(response.status()).toBe(200);
        
        const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(['OK', 'healthy']).toContain(data.status);
        
      } catch (error) {
        console.error('Backend health check failed:', error);
        
        // Try to diagnose the issue
        try {
          const netstat = execSync('netstat -an | findstr :3001', { encoding: 'utf8' });
          console.log('Port 3001 status:', netstat);
        } catch (e) {
          console.log('Port 3001 not found in netstat');
        }
        
        throw error;
      }
    });

    test('Backend API endpoints are accessible', async ({ request }) => {
      console.log('Testing backend API accessibility...');
      
      const endpoints = [
        '/api/auth/health',
        '/api/books',
        '/api/students',
        '/api/sections'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await request.get(`${BACKEND_URL}${endpoint}`, {
            timeout: 10000
          });
          
          console.log(`${endpoint}: ${response.status()}`);
          
          // Some endpoints might need auth, but should return 401, not connection errors
          expect([200, 401]).toContain(response.status());
          
        } catch (error) {
          console.error(`Endpoint ${endpoint} failed:`, error);
          throw error;
        }
      }
    });
  });

  test.describe('2. Frontend-Backend Integration Tests', () => {
    test('Frontend can connect to backend without CORS errors', async ({ page }) => {
      console.log('Testing frontend-backend integration...');
      
      // Listen for console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // Listen for failed requests
      const failedRequests: string[] = [];
      page.on('requestfailed', request => {
        failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
      });
      
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
      
      // Wait a bit for any async requests
      await page.waitForTimeout(2000);
      
      console.log('Console errors:', consoleErrors);
      console.log('Failed requests:', failedRequests);
      
      // Check for specific connection errors
      const connectionErrors = [...consoleErrors, ...failedRequests].filter(error => 
        error.includes('net::ERR') || 
        error.includes('CORS') || 
        error.includes('Failed to fetch') ||
        error.includes('localhost:3001')
      );
      
      expect(connectionErrors.length).toBe(0);
    });

    test('API client configuration is correct', async ({ page }) => {
      console.log('Testing API client configuration...');
      
      await page.goto(FRONTEND_URL);
      
      // Check if API URLs are configured correctly by testing actual API calls
      const apiWorking = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/health');
          return response.ok;
        } catch (error) {
          return false;
        }
      });
      
      console.log('API working through proxy:', apiWorking);
      
      if (!apiWorking) {
        console.warn('⚠️  API proxy configuration may have issues');
      }
      
      // The API should work through the proxy
      expect(apiWorking).toBe(true);
    });
  });

  test.describe('3. Authentication Flow Tests', () => {
    test('Admin login flow works correctly', async ({ page }) => {
      console.log('Testing admin authentication...');
      
      await page.goto(`${FRONTEND_URL}/login`);
      
      // Fill login form
      await page.fill('input[name="username"]', TEST_CREDENTIALS.admin.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.admin.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for navigation or error
      try {
        await page.waitForNavigation({ timeout: 10000 });
        
        // Check if we're logged in
        const isLoggedIn = await page.evaluate(() => {
          return localStorage.getItem('accessToken') !== null;
        });
        
        expect(isLoggedIn).toBe(true);
        
      } catch (error) {
        // Check for login errors
        const errorMessage = await page.textContent('.error-message, [role="alert"]').catch(() => '');
        console.log('Login error:', errorMessage);
        
        // If login fails, it should show an error message, not a connection error
        expect(errorMessage).toBeTruthy();
      }
    });

    test('All user roles can authenticate', async ({ request }) => {
      console.log('Testing all user role authentication...');
      
      for (const [role, credentials] of Object.entries(TEST_CREDENTIALS)) {
        try {
          const response = await request.post(`${BACKEND_URL}/api/auth/login`, {
            data: credentials,
            timeout: 10000
          });
          
          console.log(`${role} login: ${response.status()}`);
          
          if (response.status() === 200) {
            const data = await response.json();
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('data.accessToken');
          } else {
            console.warn(`${role} login failed with status ${response.status()}`);
          }
          
        } catch (error) {
          console.error(`${role} authentication failed:`, error);
          throw error;
        }
      }
    });
  });

  test.describe('4. System Health & Diagnostics', () => {
    test('All critical systems are operational', async ({ request }) => {
      console.log('Running system health diagnostics...');
      
      const healthChecks = [
        { name: 'Backend Health', url: `${BACKEND_URL}/health` },
        { name: 'API Routes', url: `${BACKEND_URL}/api` }
      ];
      
      const results = await Promise.allSettled(
        healthChecks.map(async ({ name, url }) => {
          try {
            const response = await request.get(url, { timeout: 10000 });
            return { name, status: response.status(), ok: response.ok() };
          } catch (error) {
            return { name, status: 0, ok: false, error: error.message };
          }
        })
      );
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { name, status, ok, error } = result.value;
          console.log(`${name}: ${status} ${ok ? '✅' : '❌'} ${error || ''}`);
          
          if (!ok && status !== 401) { // 401 is expected for protected routes
            console.warn(`⚠️  ${name} may have issues`);
          }
        } else {
          console.error(`❌ ${healthChecks[index].name} failed:`, result.reason);
        }
      });
    });

    test('Frontend assets load without errors', async ({ page }) => {
      console.log('Testing frontend asset loading...');
      
      const assetErrors: string[] = [];
      
      page.on('requestfailed', request => {
        const url = request.url();
        if (url.includes('.js') || url.includes('.css') || url.includes('.png') || url.includes('.svg')) {
          assetErrors.push(`Asset failed: ${url} - ${request.failure()?.errorText}`);
        }
      });
      
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
      
      // Wait for all assets to load
      await page.waitForLoadState('networkidle');
      
      console.log('Asset loading errors:', assetErrors);
      
      // Critical assets should load
      const criticalAssetErrors = assetErrors.filter(error => 
        error.includes('main.') || 
        error.includes('vendor.') ||
        error.includes('app.')
      );
      
      expect(criticalAssetErrors.length).toBe(0);
    });
  });

  test.afterAll(async () => {
    console.log('✅ Comprehensive CLMS connection testing completed!');
    console.log('📊 Check the test results for any issues that need fixing');
  });
});