import { test, expect } from '@playwright/test';
import { setupCLMSTestEnvironment, cleanupAfterCLMSTests } from './test-utils';

test.describe('Debug Authentication Flow - Filtered', () => {
  test.beforeAll(async () => {
    await setupCLMSTestEnvironment();
  });

  test.afterAll(async () => {
    await cleanupAfterCLMSTests();
  });

  test('capture authentication-specific logs only', async ({ page }) => {
    // Capture only authentication-related console messages
    const authLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      // Filter for authentication-specific logs
      if (text.includes('🚀') || text.includes('📡') || text.includes('✅') || 
          text.includes('❌') || text.includes('👤') || text.includes('🔄') ||
          text.includes('Login') || text.includes('login') || text.includes('auth')) {
        authLogs.push(`${msg.type()}: ${text}`);
      }
    });

    // Capture network requests and responses
    const networkLogs: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/')) {
        networkLogs.push(`Request: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/')) {
        const status = response.status();
        const statusText = response.statusText();
        let body = '';
        try {
          body = await response.text();
        } catch (e) {
          body = 'Could not read response body';
        }
        networkLogs.push(`Response: ${status} ${statusText} - ${response.url()}`);
        if (body.length < 500) { // Only log smaller response bodies
          networkLogs.push(`Response body: ${body}`);
        } else {
          networkLogs.push(`Response body (truncated): ${body.substring(0, 200)}...`);
        }
      }
    });

    console.log('🚀 Starting filtered authentication flow test...');
    
    // Navigate to the frontend
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    console.log('📍 Current URL:', page.url());
    
    // Check if we're on the login page
    const loginForm = page.locator('[data-testid="login-form"]');
    const isLoginVisible = await loginForm.isVisible();
    console.log('🔍 Login form visible:', isLoginVisible);
    
    if (isLoginVisible) {
      console.log('📝 Attempting login with admin credentials...');
      
      // Fill in the login form
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      
      // Click submit and wait for response
      const [response] = await Promise.all([
        page.waitForResponse(response => 
          response.url().includes('/api/auth/login'),
          { timeout: 15000 }
        ).catch(() => null),
        page.click('button[type="submit"]')
      ]);
      
      if (response) {
        console.log('✅ Login API response received');
        console.log('📊 Response status:', response.status(), response.statusText());
        const responseBody = await response.text();
        console.log('📡 Response body:', responseBody);
      } else {
        console.log('❌ Login API call failed or timed out');
      }
      
      // Wait a bit for any UI changes
      await page.waitForTimeout(3000);
      
      // Check current state
      const currentUrl = page.url();
      const dashboardVisible = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false);
      const userMenuVisible = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
      const loginFormStillVisible = await loginForm.isVisible();
      const errorMessage = await page.locator('[data-testid="error-message"]').textContent().catch(() => '');
      
      console.log('📊 Final state check:');
      console.log('  Current URL:', currentUrl);
      console.log('  Dashboard visible:', dashboardVisible);
      console.log('  User menu visible:', userMenuVisible);
      console.log('  Login form still visible:', loginFormStillVisible);
      console.log('  Error message:', errorMessage);
    }
    
    // Print all captured logs
    console.log('\n📋 Authentication Logs:');
    authLogs.forEach(log => console.log('  ', log));
    
    console.log('\n🌐 Network Logs:');
    networkLogs.forEach(log => console.log('  ', log));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-auth-flow-filtered.png', fullPage: true });
    console.log('📸 Screenshot saved as debug-auth-flow-filtered.png');
  });
});