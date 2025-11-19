import { test, expect } from '@playwright/test';

test.describe('🐛 Login Credentials Test', () => {
  test('test different login credentials', async ({ page }) => {
    console.log('🚀 Testing login credentials...');
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    // Test with librarian/librarian123 (from previous tests)
    console.log('📝 Testing with librarian/lib123...');
    await page.fill('input[id="username"]', 'librarian');
    await page.fill('input[id="password"]', 'lib123');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(3000);
    
    // Check if we're on dashboard
    const currentUrl = page.url();
    console.log('📍 URL after librarian/lib123:', currentUrl);
    
    const dashboardVisible = await page.locator('h2:has-text("Dashboard")').isVisible().catch(() => false);
    console.log('🔍 Dashboard visible with librarian/lib123:', dashboardVisible);
    
    // Test with librarian@example.com/password123 (from backend logs)
    if (!dashboardVisible) {
      console.log('📝 Testing with librarian@example.com/password123...');
      await page.goto('http://localhost:3000');
      await page.waitForTimeout(2000);
      
      await page.fill('input[id="username"]', 'librarian@example.com');
      await page.fill('input[id="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(3000);
      
      const currentUrl2 = page.url();
      console.log('📍 URL after librarian@example.com/password123:', currentUrl2);
      
      const dashboardVisible2 = await page.locator('h2:has-text("Dashboard")').isVisible().catch(() => false);
      console.log('🔍 Dashboard visible with librarian@example.com/password123:', dashboardVisible2);
    }
    
    // Test with just "librarian" as username (from backend logs)
    if (!dashboardVisible) {
      console.log('📝 Testing with librarian/password123...');
      await page.goto('http://localhost:3000');
      await page.waitForTimeout(2000);
      
      await page.fill('input[id="username"]', 'librarian');
      await page.fill('input[id="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(3000);
      
      const currentUrl3 = page.url();
      console.log('📍 URL after librarian/password123:', currentUrl3);
      
      const dashboardVisible3 = await page.locator('h2:has-text("Dashboard")').isVisible().catch(() => false);
      console.log('🔍 Dashboard visible with librarian/password123:', dashboardVisible3);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/login-credentials-test.png' });
    
    console.log('✅ Login credentials test completed');
  });
});