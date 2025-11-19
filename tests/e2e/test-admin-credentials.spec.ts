import { test, expect } from '@playwright/test';

test.describe('🐛 Test Admin Credentials', () => {
  test('test admin login credentials', async ({ page }) => {
    console.log('🔍 Testing admin credentials...');
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    // Test with admin/admin123 (from seed script)
    console.log('📝 Testing with admin/admin123...');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000);
    
    // Check if we're on dashboard
    const currentUrl = page.url();
    console.log('📍 URL after admin/admin123:', currentUrl);
    
    const dashboardVisible = await page.locator('h2:has-text("Dashboard")').isVisible().catch(() => false);
    console.log('🔍 Dashboard visible with admin/admin123:', dashboardVisible);
    
    if (dashboardVisible) {
      console.log('✅ SUCCESS: admin/admin123 works!');
      return;
    }
    
    // Check for error message
    const errorMessage = await page.locator('text=Login failed').isVisible().catch(() => false);
    console.log('❌ Error message visible:', errorMessage);
    
    console.log('❌ admin/admin123 failed');
  });
});