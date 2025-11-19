import { test, expect } from '@playwright/test';

test('Debug login process', async ({ page }) => {
  console.log('🚀 Starting debug test...');

  // Navigate to frontend
  await page.goto('http://localhost:3000');
  console.log('📍 Current URL:', page.url());

  // Check if login form is present
  const usernameInput = await page
    .locator('input[name="username"]')
    .isVisible()
    .catch(() => false);
  const passwordInput = await page
    .locator('input[name="password"]')
    .isVisible()
    .catch(() => false);
  const submitButton = await page
    .locator('button[type="submit"]')
    .isVisible()
    .catch(() => false);

  console.log('🔍 Login form elements:');
  console.log('  Username input visible:', usernameInput);
  console.log('  Password input visible:', passwordInput);
  console.log('  Submit button visible:', submitButton);

  if (usernameInput && passwordInput && submitButton) {
    console.log('✅ Login form found, attempting login...');

    // Fill login form
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');

    console.log('📝 Form filled, clicking submit...');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait a bit and check what happened
    await page.waitForTimeout(3000);

    console.log('📍 URL after submit:', page.url());

    // Check what's on the page
    const pageContent = await page.content();
    console.log('📄 Page content length:', pageContent.length);

    // Look for key elements
    const dashboardVisible = await page
      .locator('[data-testid="dashboard"]')
      .isVisible()
      .catch(() => false);
    const userMenuVisible = await page
      .locator('button:has-text("admin")')
      .isVisible()
      .catch(() => false);
    const loginFormStillVisible = await page
      .locator('input[name="username"]')
      .isVisible()
      .catch(() => false);

    console.log('🔍 After submit:');
    console.log('  Dashboard visible:', dashboardVisible);
    console.log('  User menu visible:', userMenuVisible);
    console.log('  Login form still visible:', loginFormStillVisible);

    if (dashboardVisible || userMenuVisible) {
      console.log('✅ Login appears successful!');
    } else if (loginFormStillVisible) {
      console.log('❌ Login failed - still on login form');

      // Check for error messages
      const errorMessage = await page
        .locator('[role="alert"], .error, .text-red-500')
        .textContent()
        .catch(() => '');
      console.log('  Error message:', errorMessage);
    } else {
      console.log(
        '❓ Unknown state - neither login form nor dashboard visible'
      );
    }
  } else {
    console.log(
      '❌ Login form not found - might already be logged in or on different page'
    );

    // Check if we're already on dashboard
    const dashboardVisible = await page
      .locator('[data-testid="dashboard"]')
      .isVisible()
      .catch(() => false);
    console.log('  Dashboard visible:', dashboardVisible);
  }

  console.log('🧹 Debug test completed');
});
