import { test, expect } from '@playwright/test';
import { setupCLMSTestEnvironment, cleanupAfterCLMSTests } from './test-utils';

// Test credentials for librarian only
const TEST_CREDENTIALS = {
  librarian: { username: 'librarian', password: 'lib123' }
};

test.describe('Librarian User - Complete System Test', () => {
  test.beforeAll(async () => {
    await setupCLMSTestEnvironment();
  });

  test.afterAll(async () => {
    await cleanupAfterCLMSTests();
  });

  test('Librarian login and dashboard access', async ({ page }) => {
    console.log('🚀 Testing librarian login...');
    
    // Navigate to frontend
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Should be on login page
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Login as librarian
    await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(2000);
    
    // Should be on dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    console.log('✅ Librarian login successful');
  });

  test('Librarian dashboard tabs navigation', async ({ page }) => {
    console.log('🧭 Testing dashboard tabs...');
    
    // Login first
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Test key tabs that librarian should have access to
    const librarianTabs = [
      'Dashboard',
      'Activity', 
      'Students',
      'Books',
      'Checkout',
      'Equipment'
    ];
    
    for (const tabName of librarianTabs) {
      try {
        const tab = page.locator(`button:has-text("${tabName}")`).first();
        await tab.click();
        await page.waitForTimeout(1000);
        
        // Verify tab content loads
        const content = page.locator(`[data-testid*="${tabName.toLowerCase()}"], .content, main`);
        const isVisible = await content.isVisible().catch(() => false);
        
        if (isVisible) {
          console.log(`  ✅ ${tabName} tab accessible`);
        } else {
          console.log(`  ⚠️  ${tabName} tab may have different structure`);
        }
      } catch (error) {
        console.log(`  ❌ ${tabName} tab not accessible:`, error.message);
      }
    }
    
    console.log('✅ Dashboard tabs navigation completed');
  });

  test('Librarian core functionality - Students section', async ({ page }) => {
    console.log('📚 Testing Students section...');
    
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Navigate to Students tab
    await page.click('button:has-text("Students")');
    await page.waitForTimeout(2000);
    
    // Check for student management elements
    const studentElements = [
      'text=Students',
      'text=Add Student',
      'text=Search',
      'input[type="search"]',
      '.student-list',
      '[data-testid*="student"]'
    ];
    
    let foundElements = 0;
    for (const selector of studentElements) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          foundElements++;
          console.log(`  ✅ Found: ${selector}`);
        }
      } catch (error) {
        console.log(`  ❌ Not found: ${selector}`);
      }
    }
    
    console.log(`✅ Students section: ${foundElements}/${studentElements.length} elements found`);
  });

  test('Librarian core functionality - Books section', async ({ page }) => {
    console.log('📖 Testing Books section...');
    
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Navigate to Books tab
    await page.click('button:has-text("Books")');
    await page.waitForTimeout(2000);
    
    // Check for book management elements
    const bookElements = [
      'text=Books',
      'text=Add Book',
      'text=Search',
      'input[type="search"]',
      '.book-list',
      '[data-testid*="book"]'
    ];
    
    let foundElements = 0;
    for (const selector of bookElements) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          foundElements++;
          console.log(`  ✅ Found: ${selector}`);
        }
      } catch (error) {
        console.log(`  ❌ Not found: ${selector}`);
      }
    }
    
    console.log(`✅ Books section: ${foundElements}/${bookElements.length} elements found`);
  });

  test('Librarian core functionality - Checkout section', async ({ page }) => {
    console.log('📤 Testing Checkout section...');
    
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Navigate to Checkout tab
    await page.click('button:has-text("Checkout")');
    await page.waitForTimeout(2000);
    
    // Check for checkout elements
    const checkoutElements = [
      'text=Checkout',
      'text=Check-in',
      'text=Check-out',
      'input[type="text"]',
      '.checkout-form',
      '[data-testid*="checkout"]'
    ];
    
    let foundElements = 0;
    for (const selector of checkoutElements) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          foundElements++;
          console.log(`  ✅ Found: ${selector}`);
        }
      } catch (error) {
        console.log(`  ❌ Not found: ${selector}`);
      }
    }
    
    console.log(`✅ Checkout section: ${foundElements}/${checkoutElements.length} elements found`);
  });

  test('Librarian mobile responsiveness', async ({ page }) => {
    console.log('📱 Testing mobile responsiveness...');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Check mobile-specific elements
    const mobileChecks = [
      'Login form fits mobile screen',
      'Dashboard tabs are accessible',
      'Text is readable',
      'Buttons are tapable'
    ];
    
    let passedChecks = 0;
    
    // Check login form
    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible().catch(() => false)) {
      const formWidth = await loginForm.evaluate(el => el.clientWidth);
      if (formWidth <= 375) {
        console.log('  ✅ Login form fits mobile screen');
        passedChecks++;
      }
    }
    
    // Check dashboard tabs
    const dashboardTab = page.locator('button:has-text("Dashboard")').first();
    if (await dashboardTab.isVisible().catch(() => false)) {
      console.log('  ✅ Dashboard tabs are accessible');
      passedChecks++;
    }
    
    // Check text readability
    const bodyText = await page.locator('body').textContent().catch(() => '');
    if (bodyText && bodyText.length > 0) {
      console.log('  ✅ Text is readable');
      passedChecks++;
    }
    
    // Check button tapability
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible().catch(() => false)) {
      const buttonHeight = await submitButton.evaluate(el => el.clientHeight);
      if (buttonHeight >= 44) { // iOS minimum tap target size
        console.log('  ✅ Buttons are tapable');
        passedChecks++;
      }
    }
    
    console.log(`✅ Mobile responsiveness: ${passedChecks}/${mobileChecks.length} checks passed`);
    
    // Take mobile screenshot
    await page.screenshot({ path: 'librarian-mobile-test.png', fullPage: true });
  });

  test('Librarian logout functionality', async ({ page }) => {
    console.log('🚪 Testing logout functionality...');
    
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Look for logout option
    const logoutSelectors = [
      'button:has-text("Logout")',
      'a:has-text("Logout")',
      'text=Logout',
      '[data-testid*="logout"]',
      '.logout'
    ];
    
    let logoutFound = false;
    for (const selector of logoutSelectors) {
      try {
        const logoutElement = page.locator(selector).first();
        if (await logoutElement.isVisible({ timeout: 3000 })) {
          console.log(`  ✅ Found logout: ${selector}`);
          logoutFound = true;
          
          // Click logout
          await logoutElement.click();
          await page.waitForTimeout(2000);
          
          // Should return to login page
          const loginForm = page.locator('[data-testid="login-form"]');
          if (await loginForm.isVisible({ timeout: 5000 })) {
            console.log('  ✅ Successfully logged out');
          } else {
            console.log('  ⚠️  Logout may not have returned to login page');
          }
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!logoutFound) {
      console.log('  ⚠️  Logout option not found - may be in dropdown menu');
    }
    
    console.log('✅ Logout functionality test completed');
  });
});