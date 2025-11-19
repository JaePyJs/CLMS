import { test, expect } from '@playwright/test';

test.describe('CLMS Librarian User - Full Functionality Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for login form to appear
    await page.waitForSelector('input[id="username"]', { timeout: 10000 });
    
    // Login as librarian
    await page.fill('input[id="username"]', 'librarian');
    await page.fill('input[id="password"]', 'lib123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });
    
    // Wait for any loading spinners to disappear
    await page.waitForLoadState('networkidle');
  });

  test('should test all main navigation tabs and verify buttons work', async ({ page }) => {
    console.log('🧪 Starting comprehensive functionality test...');
    
    // Test Dashboard tab
    console.log('📊 Testing Dashboard tab...');
    await page.click('[role="tab"]:has-text("Dashboard")');
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();
    
    // Test refresh button
    await page.click('button:has-text("Refresh")');
    await expect(page.locator('text=Last updated:')).toBeVisible();
    
    // Test Activity tab (which is actually "Scan" in the UI)
    console.log('📱 Testing Activity tab...');
    await page.click('[role="tab"]:has-text("Activity")');
    // Wait for the scan workspace to load
    await page.waitForTimeout(2000);
    
    // Test Students tab
    console.log('👥 Testing Students tab...');
    await page.click('[role="tab"]:has-text("Students")');
    await expect(page.locator('h2:has-text("Student Management")')).toBeVisible();
    
    // Test search functionality
    await page.fill('input[placeholder*="Search students"]', 'test');
    await page.keyboard.press('Enter');
    
    // Test Books tab
    console.log('📚 Testing Books tab...');
    await page.click('[role="tab"]:has-text("Books")');
    await expect(page.locator('h2:has-text("Book Catalog")')).toBeVisible();
    
    // Test book search
    await page.fill('input[placeholder*="Search books"]', 'test');
    await page.keyboard.press('Enter');
    
    // Test Checkout tab (main focus)
    console.log('📋 Testing Checkout tab...');
    await page.click('[role="tab"]:has-text("Checkout")');
    await expect(page.locator('h2:has-text("Book Checkout & Return")')).toBeVisible();
    
    // Test checkout workflow
    console.log('🔍 Testing checkout workflow...');
    
    // Test student scanning
    await page.fill('input[id="studentBarcode"]', 'STU001');
    await page.click('button:has-text("Find")');
    
    // Wait for student to be found
    await page.waitForTimeout(2000);
    
    // Test book scanning
    await page.fill('input[id="bookBarcode"]', 'BOOK001');
    await page.click('button:has-text("Find")');
    
    // Wait for book to be found
    await page.waitForTimeout(2000);
    
    // Test return workflow
    console.log('🔄 Testing return workflow...');
    await page.click('[role="tab"]:has-text("Return Book")');
    await page.fill('input[id="returnBarcode"]', 'BOOK001');
    await page.click('button:has-text("Find")');
    
    console.log('✅ Checkout workflow tests completed');
  });

  test('should test Equipment tab functionality', async ({ page }) => {
    console.log('💻 Testing Equipment tab...');
    await page.click('[role="tab"]:has-text("Equipment")');
    await expect(page.locator('h2:has-text("Equipment Management")')).toBeVisible();
    
    // Test equipment search
    await page.fill('input[placeholder*="Search equipment"]', 'laptop');
    await page.keyboard.press('Enter');
    
    console.log('✅ Equipment tab tests completed');
  });

  test('should test Analytics tab functionality', async ({ page }) => {
    console.log('📈 Testing Analytics tab...');
    await page.click('[role="tab"]:has-text("Analytics")');
    await expect(page.locator('h2:has-text("Analytics Dashboard")')).toBeVisible();
    
    // Test analytics tabs
    await page.click('[role="tab"]:has-text("Book Circulation")');
    await page.click('[role="tab"]:has-text("Equipment Utilization")');
    await page.click('[role="tab"]:has-text("Fine Collection")');
    
    console.log('✅ Analytics tab tests completed');
  });

  test('should test Reports tab functionality', async ({ page }) => {
    console.log('📊 Testing Reports tab...');
    await page.click('[role="tab"]:has-text("Reports")');
    await expect(page.locator('h2:has-text("Reports Builder")')).toBeVisible();
    
    // Test report generation buttons
    await page.click('button:has-text("Daily Report")');
    await page.click('button:has-text("Weekly Report")');
    await page.click('button:has-text("Monthly Report")');
    
    console.log('✅ Reports tab tests completed');
  });

  test('should test Settings tab functionality', async ({ page }) => {
    console.log('⚙️ Testing Settings tab...');
    await page.click('[role="tab"]:has-text("Settings")');
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
    
    // Test settings sections
    await page.click('button:has-text("System Settings")');
    await page.click('button:has-text("User Management")');
    await page.click('button:has-text("Backup & Restore")');
    
    console.log('✅ Settings tab tests completed');
  });

  test('should test header functionality', async ({ page }) => {
    console.log('🔧 Testing header functionality...');
    
    // Test theme toggle
    await page.click('button[aria-label*="theme"], button:has-text("🌙"), button:has-text("☀️")');
    
    // Test notification center
    await page.click('[data-testid="notification-center"]');
    await expect(page.locator('text=Notifications')).toBeVisible();
    
    // Close notification panel
    await page.click('button:has-text("✕")');
    
    // Test user menu
    await page.click('button:has-text("librarian")');
    await expect(page.locator('text=Profile Settings')).toBeVisible();
    
    console.log('✅ Header functionality tests completed');
  });

  test('should test mobile navigation', async ({ page }) => {
    console.log('📱 Testing mobile navigation...');
    
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test mobile menu
    await page.click('button:has-text("☰")');
    await expect(page.locator('text=Navigation')).toBeVisible();
    
    // Test mobile bottom navigation
    await page.click('button:has-text("Dashboard")');
    await page.click('button:has-text("Students")');
    await page.click('button:has-text("Books")');
    
    console.log('✅ Mobile navigation tests completed');
  });

  test('should verify no console errors', async ({ page }) => {
    console.log('🔍 Checking for console errors...');
    
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate through a few tabs to trigger any potential errors
    await page.click('[role="tab"]:has-text("Dashboard")');
    await page.waitForTimeout(1000);
    await page.click('[role="tab"]:has-text("Checkout")');
    await page.waitForTimeout(1000);
    await page.click('[role="tab"]:has-text("Students")');
    await page.waitForTimeout(1000);
    
    // Check for errors
    expect(consoleErrors.length).toBe(0);
    
    if (consoleErrors.length > 0) {
      console.log('❌ Console errors found:', consoleErrors);
    } else {
      console.log('✅ No console errors found');
    }
  });

  test('should test logout functionality', async ({ page }) => {
    console.log('🚪 Testing logout functionality...');
    
    // Click user menu
    await page.click('button:has-text("librarian")');
    
    // Click logout
    await page.click('button:has-text("Logout")');
    
    // Verify we're back at login screen
    await expect(page.locator('input[id="username"]')).toBeVisible();
    
    console.log('✅ Logout functionality test completed');
  });
});