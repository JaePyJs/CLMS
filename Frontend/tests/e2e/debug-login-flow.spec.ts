import { test, expect } from '@playwright/test';

const LIBRARIAN_CREDENTIALS = {
  username: 'librarian',
  password: 'password123',
};

test.describe('🔍 Debug Login Flow', () => {
  test('should verify login is working correctly', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3002');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('📸 Taking screenshot of initial state...');
    await page.screenshot({ path: 'debug-login-initial.png', fullPage: true });

    // Fill login form
    console.log('📝 Filling login form...');
    await page.fill('input[name="username"]', LIBRARIAN_CREDENTIALS.username);
    await page.fill('input[name="password"]', LIBRARIAN_CREDENTIALS.password);
    
    // Take screenshot before clicking
    await page.screenshot({ path: 'debug-login-filled.png', fullPage: true });

    // Click login button
    console.log('🚀 Clicking login button...');
    await page.click('button[type="submit"]');

    // Wait and see what happens
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Give extra time for any redirects

    // Check current URL and state
    const currentUrl = page.url();
    console.log('📍 Current URL after login:', currentUrl);

    // Check for authentication indicators
    const welcomeText = await page.locator('text="Welcome"').count();
    const dashboardText = await page.locator('text="Dashboard"').count();
    const usernameText = await page.locator('text="librarian"').count();
    
    console.log(`🔍 Found: Welcome=${welcomeText}, Dashboard=${dashboardText}, Username=${usernameText}`);

    // Take final screenshot
    await page.screenshot({ path: 'debug-login-final.png', fullPage: true });

    // Check if we're actually logged in
    const isLoggedIn = welcomeText > 0 || dashboardText > 0 || usernameText > 0;
    
    if (isLoggedIn) {
      console.log('✅ Login appears to be working!');
    } else {
      console.log('❌ Login does not appear to be working');
      
      // Check what's on the page
      const pageTitle = await page.title();
      const pageContent = await page.locator('body').textContent();
      console.log(`📄 Page title: ${pageTitle}`);
      console.log(`📄 Page content preview: ${pageContent?.substring(0, 200)}...`);
    }

    expect(isLoggedIn).toBe(true);
  });

  test('should check localStorage after login', async ({ page }) => {
    await page.goto('http://localhost:3002');
    
    // Clear any existing auth data
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Login
    await page.fill('input[name="username"]', LIBRARIAN_CREDENTIALS.username);
    await page.fill('input[name="password"]', LIBRARIAN_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check localStorage for auth data
    const authData = await page.evaluate(() => {
      return {
        localStorage: {
          token: localStorage.getItem('clms_token'),
          user: localStorage.getItem('clms_user')
        },
        sessionStorage: {
          token: sessionStorage.getItem('clms_token'),
          user: sessionStorage.getItem('clms_user')
        }
      };
    });

    console.log('🔐 Auth data found:', authData);

    const hasToken = authData.localStorage.token || authData.sessionStorage.token;
    const hasUser = authData.localStorage.user || authData.sessionStorage.user;

    if (hasToken) {
      console.log('✅ Authentication token found');
    } else {
      console.log('❌ No authentication token found');
    }

    if (hasUser) {
      console.log('✅ User data found');
    } else {
      console.log('❌ No user data found');
    }

    expect(hasToken).toBeTruthy();
  });
});