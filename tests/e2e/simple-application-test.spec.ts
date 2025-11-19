import { test, expect } from '@playwright/test';

test.describe('🐛 Simple Application Test', () => {
  test('check if application loads at all', async ({ page }) => {
    console.log('🚀 Testing basic application load...');
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait a bit for the page to load
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/simple-test-initial.png' });
    
    // Check if there's any content
    const bodyText = await page.textContent('body');
    console.log('📄 Body text preview:', bodyText?.substring(0, 200));
    
    // Check for common elements
    const hasLogin = bodyText?.toLowerCase().includes('login') || false;
    const hasDashboard = bodyText?.toLowerCase().includes('dashboard') || false;
    const hasEmail = bodyText?.toLowerCase().includes('email') || false;
    const hasPassword = bodyText?.toLowerCase().includes('password') || false;
    
    console.log('🔍 Contains "login":', hasLogin);
    console.log('🔍 Contains "dashboard":', hasDashboard);
    console.log('🔍 Contains "email":', hasEmail);
    console.log('🔍 Contains "password":', hasPassword);
    
    // Check if we're redirected
    console.log('📍 Current URL:', page.url());
    
    // Try to find any form elements
    const inputs = await page.locator('input').count();
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    
    console.log('📝 Number of inputs:', inputs);
    console.log('🔘 Number of buttons:', buttons);
    console.log('🔗 Number of links:', links);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/simple-test-final.png' });
    
    console.log('✅ Simple test completed');
  });
});