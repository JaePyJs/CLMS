import { test, expect } from '@playwright/test';
import { setupCLMSTestEnvironment, cleanupAfterCLMSTests } from './test-utils';

test.describe('Debug Authentication Flow', () => {
  test.beforeAll(async () => {
    await setupCLMSTestEnvironment();
  });

  test.afterAll(async () => {
    await cleanupAfterCLMSTests();
  });

  test('capture console logs during login attempt', async ({ page }) => {
    // Capture all console messages
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
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
        networkLogs.push(
          `Response: ${status} ${statusText} - ${response.url()}`
        );
        networkLogs.push(`Response body: ${body.substring(0, 200)}...`);
      }
    });

    console.log('🚀 Starting detailed authentication flow test...');

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
        page
          .waitForResponse(
            (response) =>
              response.url().includes('/api/auth/login') &&
              response.status() === 200,
            { timeout: 10000 }
          )
          .catch(() => null),
        page.click('button[type="submit"]'),
      ]);

      if (response) {
        console.log('✅ Login API call succeeded');
        const responseBody = await response.text();
        console.log('📡 Login response:', responseBody);
      } else {
        console.log('❌ Login API call failed or timed out');
      }

      // Wait a bit for any UI changes
      await page.waitForTimeout(2000);

      // Check current state
      const currentUrl = page.url();
      const dashboardVisible = await page
        .locator('[data-testid="dashboard"]')
        .isVisible()
        .catch(() => false);
      const userMenuVisible = await page
        .locator('[data-testid="user-menu"]')
        .isVisible()
        .catch(() => false);
      const loginFormStillVisible = await loginForm.isVisible();
      const errorMessage = await page
        .locator('[data-testid="error-message"]')
        .textContent()
        .catch(() => '');

      console.log('📊 Final state check:');
      console.log('  Current URL:', currentUrl);
      console.log('  Dashboard visible:', dashboardVisible);
      console.log('  User menu visible:', userMenuVisible);
      console.log('  Login form still visible:', loginFormStillVisible);
      console.log('  Error message:', errorMessage);
    }

    // Print all captured logs
    console.log('\n📋 Console Messages:');
    consoleMessages.forEach((msg) => console.log('  ', msg));

    console.log('\n🌐 Network Logs:');
    networkLogs.forEach((log) => console.log('  ', log));

    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-auth-flow.png', fullPage: true });
    console.log('📸 Screenshot saved as debug-auth-flow.png');
  });
});
