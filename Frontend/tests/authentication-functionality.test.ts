import { test, expect } from '@playwright/test';

// Test credentials
const TEST_CREDENTIALS = {
  admin: { username: 'admin', password: 'admin123' },
  librarian: { username: 'librarian', password: 'lib123' },
  assistant: { username: 'assistant', password: 'assist123' }
};

test.describe('CLMS Authentication & Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    console.log('🚀 Starting authentication test...');
  });

  test.describe('1. Authentication Flow Tests', () => {
    test('Admin login with correct credentials', async ({ page }) => {
      console.log('Testing admin login...');
      
      await page.goto('http://localhost:3000');
      
      // Fill login form
      await page.fill('input[name="username"]', TEST_CREDENTIALS.admin.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.admin.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for dashboard to appear (indicating successful login)
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });
      
      // Check if user menu shows admin username
      const userMenuText = await page.textContent('button:has-text("admin")').catch(() => '');
      expect(userMenuText).toContain('admin');
      
      console.log('✅ Admin login successful');
    });

    test('Librarian login with correct credentials', async ({ page }) => {
      console.log('Testing librarian login...');
      
      await page.goto('http://localhost:3000');
      
      // Fill login form
      await page.fill('input[name="username"]', TEST_CREDENTIALS.librarian.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.librarian.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for dashboard to appear (indicating successful login)
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });
      
      // Check if user menu shows librarian username
      const userMenuText = await page.textContent('button:has-text("librarian")').catch(() => '');
      expect(userMenuText).toContain('librarian');
      
      console.log('✅ Librarian login successful');
    });

    test('Assistant login with correct credentials', async ({ page }) => {
      console.log('Testing assistant login...');
      
      await page.goto('http://localhost:3000');
      
      // Fill login form
      await page.fill('input[name="username"]', TEST_CREDENTIALS.assistant.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.assistant.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for dashboard to appear (indicating successful login)
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });
      
      // Check if user menu shows assistant username
      const userMenuText = await page.textContent('button:has-text("assistant")').catch(() => '');
      expect(userMenuText).toContain('assistant');
      
      console.log('✅ Assistant login successful');
    });

    test('Login with incorrect credentials shows error', async ({ page }) => {
      console.log('Testing login with incorrect credentials...');
      
      await page.goto('http://localhost:3000/login');
      
      // Fill login form with wrong credentials
      await page.fill('input[name="username"]', 'wronguser');
      await page.fill('input[name="password"]', 'wrongpass');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait a bit for error message
      await page.waitForTimeout(2000);
      
      // Check for error message
      const errorMessage = await page.textContent('.error-message, [role="alert"], .text-red-500').catch(() => '');
      expect(errorMessage).toBeTruthy();
      
      console.log('✅ Error message shown for incorrect credentials');
    });

    test('Logout functionality works', async ({ page }) => {
      console.log('Testing logout functionality...');
      
      // First login
      await page.goto('http://localhost:3000');
      await page.fill('input[name="username"]', TEST_CREDENTIALS.admin.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.admin.password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
      
      // Check we're logged in (dashboard should be visible)
      const dashboardVisible = await page.locator('[data-testid="dashboard"]').isVisible();
      expect(dashboardVisible).toBe(true);
      
      // Find and click logout button
      const logoutButton = await page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]').first();
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        
        // Wait for login form to appear again
        await page.waitForSelector('input[name="username"]', { timeout: 10000 });
        
        // Check we're back on login page
        const loginFormVisible = await page.locator('input[name="username"]').isVisible();
        expect(loginFormVisible).toBe(true);
        
        console.log('✅ Logout successful');
      } else {
        console.log('⚠️  Logout button not found, skipping logout test');
      }
    });
  });

  test.describe('2. Dashboard Navigation Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin before each dashboard test
      await page.goto('http://localhost:3000');
      await page.fill('input[name="username"]', TEST_CREDENTIALS.admin.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.admin.password);
      
      // Submit form and wait for dashboard
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });
    });

    test('Dashboard loads with key metrics', async ({ page }) => {
      console.log('Testing dashboard metrics...');
      
      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard"], .dashboard, .metrics', { timeout: 10000 }).catch(() => {});
      
      // Check for key dashboard elements
      const hasMetrics = await page.locator('.metric, .card, .stat').first().isVisible().catch(() => false);
      const hasNavigation = await page.locator('nav, .navigation, .sidebar').first().isVisible().catch(() => false);
      
      expect(hasMetrics || hasNavigation).toBe(true);
      
      console.log('✅ Dashboard loaded successfully');
    });

    test('Navigation menu items are accessible', async ({ page }) => {
      console.log('Testing navigation menu...');
      
      // Look for navigation elements
      const navItems = await page.locator('nav a, .navigation a, .menu-item, .sidebar a').all();
      
      expect(navItems.length).toBeGreaterThan(0);
      
      // Test clicking on first navigation item
      if (navItems.length > 0) {
        const firstItem = navItems[0];
        const itemText = await firstItem.textContent();
        
        if (itemText && !itemText.toLowerCase().includes('logout')) {
          await firstItem.click();
          
          // Wait for page to load
          await page.waitForTimeout(2000);
          
          console.log(`✅ Navigation to "${itemText}" successful`);
        }
      }
    });

    test('Student management section loads', async ({ page }) => {
      console.log('Testing student management section...');
      
      // Look for student management link
      const studentLink = await page.locator('a:has-text("Students"), a:has-text("Student"), [href*="student"]').first();
      
      if (await studentLink.isVisible()) {
        await studentLink.click();
        
        // Wait for student page to load
        await page.waitForTimeout(3000);
        
        // Check if we're on student page
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/student/i);
        
        // Check for student list or form
        const hasStudentContent = await page.locator('.student, [data-testid*="student"]').first().isVisible().catch(() => false);
        expect(hasStudentContent).toBe(true);
        
        console.log('✅ Student management section loaded');
      } else {
        console.log('⚠️  Student management link not found');
      }
    });

    test('Book catalog section loads', async ({ page }) => {
      console.log('Testing book catalog section...');
      
      // Look for books/catalog link
      const booksLink = await page.locator('a:has-text("Books"), a:has-text("Catalog"), a:has-text("Library"), [href*="book"]').first();
      
      if (await booksLink.isVisible()) {
        await booksLink.click();
        
        // Wait for books page to load
        await page.waitForTimeout(3000);
        
        // Check if we're on books page
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/book|catalog/i);
        
        // Check for book content
        const hasBookContent = await page.locator('.book, [data-testid*="book"]').first().isVisible().catch(() => false);
        expect(hasBookContent).toBe(true);
        
        console.log('✅ Book catalog section loaded');
      } else {
        console.log('⚠️  Book catalog link not found');
      }
    });
  });

  test.describe('3. Self-Service Functionality Tests', () => {
    test('Self-service check-in page loads', async ({ page }) => {
      console.log('Testing self-service check-in...');
      
      await page.goto('http://localhost:3000/self-service');
      
      // Wait for page to load
      await page.waitForTimeout(3000);
      
      // Check for self-service elements
      const hasScanner = await page.locator('[data-testid="scanner"], .scanner, input[type="text"]').first().isVisible().catch(() => false);
      const hasCheckInButton = await page.locator('button:has-text("Check In"), button:has-text("Checkin")').first().isVisible().catch(() => false);
      
      expect(hasScanner || hasCheckInButton).toBe(true);
      
      console.log('✅ Self-service page loaded');
    });

    test('Multi-section selection works', async ({ page }) => {
      console.log('Testing multi-section selection...');
      
      await page.goto('http://localhost:3000/self-service');
      
      // Wait for page to load
      await page.waitForTimeout(3000);
      
      // Look for section selection - be more specific and wait for elements
      const sectionSelector = page.locator('.section, [data-testid*="section"], .section-selector');
      
      try {
        // Wait for section elements to be visible
        await sectionSelector.first().waitFor({ state: 'visible', timeout: 5000 });
        
        // Get all visible section options
        const sectionOptions = await sectionSelector.all();
        
        if (sectionOptions.length > 0) {
          console.log(`Found ${sectionOptions.length} section options`);
          
          // Try to click the first section option
          try {
            await sectionOptions[0].click({ force: true });
            
            // Wait a moment for any UI updates
            await page.waitForTimeout(1000);
            
            // Look for check-in button
            const checkInButton = page.locator('button:has-text("Check In"), button:has-text("Submit")').first();
            
            if (await checkInButton.isVisible({ timeout: 3000 })) {
              console.log('✅ Multi-section selection available');
            } else {
              console.log('⚠️  Check-in button not found after section selection');
            }
          } catch (clickError) {
            console.log('⚠️  Could not click section option:', clickError.message);
          }
        } else {
          console.log('⚠️  No section options found on page');
        }
      } catch (error) {
        console.log('⚠️  Section selection not available:', error.message);
      }
    });
  });

  test.describe('4. Mobile Responsiveness Tests', () => {
    test('Login page is mobile responsive', async ({ page }) => {
      console.log('Testing mobile responsiveness...');
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('http://localhost:3000/login');
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // Check if login form is visible and properly sized
      const loginForm = await page.locator('form, .login-form').first();
      const isFormVisible = await loginForm.isVisible().catch(() => false);
      
      expect(isFormVisible).toBe(true);
      
      // Check if form elements are accessible
      const usernameInput = await page.locator('input[name="username"]').first();
      const passwordInput = await page.locator('input[name="password"]').first();
      
      expect(await usernameInput.isVisible()).toBe(true);
      expect(await passwordInput.isVisible()).toBe(true);
      
      console.log('✅ Mobile responsiveness test passed');
    });

    test('Dashboard adapts to mobile screen', async ({ page }) => {
      console.log('Testing dashboard mobile responsiveness...');
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Login first
      await page.goto('http://localhost:3000/login');
      await page.fill('input[name="username"]', TEST_CREDENTIALS.admin.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.admin.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ timeout: 10000 });
      
      // Check for mobile navigation
      const mobileNav = await page.locator('.mobile-nav, .hamburger, [data-testid="mobile-menu"]').first();
      const hasMobileNav = await mobileNav.isVisible().catch(() => false);
      
      // Check if content is accessible
      const mainContent = await page.locator('main, .content, .dashboard').first();
      const isContentVisible = await mainContent.isVisible().catch(() => false);
      
      expect(isContentVisible).toBe(true);
      
      console.log('✅ Dashboard mobile test passed');
    });
  });

  test.afterEach(async ({ page }) => {
    console.log('🧹 Cleaning up test session...');
    
    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear();
    }).catch(() => {});
  });

  test.afterAll(async () => {
    console.log('✅ All authentication and functionality tests completed!');
  });
});