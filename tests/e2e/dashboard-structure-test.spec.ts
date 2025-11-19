import { test, expect } from '@playwright/test';

test.describe('🐛 Dashboard Structure Test', () => {
  test('analyze actual dashboard structure after login', async ({ page }) => {
    console.log('🔍 Analyzing dashboard structure after successful login...');
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    // Login with admin credentials
    console.log('📝 Logging in with admin/admin123...');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000);
    
    // Check current URL
    const currentUrl = page.url();
    console.log('📍 Current URL after login:', currentUrl);
    
    // Get all text content
    const bodyText = await page.textContent('body');
    console.log('📄 Full body text:', bodyText);
    
    // Look for dashboard-related elements
    const hasDashboard = bodyText?.toLowerCase().includes('dashboard') || false;
    const hasTabs = bodyText?.toLowerCase().includes('activity') || false;
    const hasStudents = bodyText?.toLowerCase().includes('students') || false;
    const hasBooks = bodyText?.toLowerCase().includes('books') || false;
    
    console.log('🔍 Content analysis:');
    console.log('  Contains "dashboard":', hasDashboard);
    console.log('  Contains "activity":', hasTabs);
    console.log('  Contains "students":', hasStudents);
    console.log('  Contains "books":', hasBooks);
    
    // Look for specific elements
    const h1Elements = await page.locator('h1').allTextContents();
    const h2Elements = await page.locator('h2').allTextContents();
    const h3Elements = await page.locator('h3').allTextContents();
    
    console.log('📋 H1 elements:', h1Elements);
    console.log('📋 H2 elements:', h2Elements);
    console.log('📋 H3 elements:', h3Elements);
    
    // Look for navigation tabs
    const tabs = await page.locator('[role="tab"]').allTextContents();
    console.log('📑 Tab elements:', tabs);
    
    // Look for buttons
    const buttons = await page.locator('button').allTextContents();
    console.log('🔘 Button elements:', buttons);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-structure.png' });
    
    console.log('✅ Dashboard structure analysis completed');
  });
});