import { test, expect } from '@playwright/test';

test.describe('🐛 Find Correct Credentials Test', () => {
  test('find working login credentials', async ({ page }) => {
    console.log('🔍 Finding correct login credentials...');
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    // Test with librarian/lib123 (from previous tests)
    console.log('📝 Testing with librarian/lib123...');
    await page.fill('input[id="username"]', 'librarian');
    await page.fill('input[id="password"]', 'lib123');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000);
    
    // Check if we're on dashboard
    const currentUrl = page.url();
    console.log('📍 URL after librarian/lib123:', currentUrl);
    
    const dashboardVisible = await page.locator('h2:has-text("Dashboard")').isVisible().catch(() => false);
    console.log('🔍 Dashboard visible with librarian/lib123:', dashboardVisible);
    
    if (dashboardVisible) {
      console.log('✅ SUCCESS: librarian/lib123 works!');
      return;
    }
    
    // Check for error message
    const errorMessage = await page.locator('text=Login failed').isVisible().catch(() => false);
    console.log('❌ Error message visible:', errorMessage);
    
    console.log('❌ librarian/lib123 failed');
  });
});