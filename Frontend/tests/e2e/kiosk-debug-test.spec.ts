import { test, expect } from '@playwright/test';

test.describe('🎯 Kiosk Interface - Debug Test', () => {
  test('🔍 Debug kiosk page - check what actually renders', async ({ page }) => {
    console.log('🚀 Navigating to kiosk interface...');
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console error:', msg.text());
      }
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.log('❌ Page error:', error.message);
    });
    
    // Navigate to kiosk interface
    await page.goto('http://localhost:3000/kiosk');
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more for any JavaScript to execute
    await page.waitForTimeout(3000);
    
    // Take a screenshot to see what's happening
    await page.screenshot({ path: 'kiosk-debug-screen.png', fullPage: true });
    
    console.log('🔍 Checking page content...');
    
    // Get the full page content
    const pageContent = await page.content();
    console.log('📄 Page content length:', pageContent.length);
    
    // Check if there's any content at all
    const bodyText = await page.textContent('body');
    console.log('📝 Body text preview:', bodyText?.substring(0, 500));
    
    // Check for any h1 elements
    const h1Elements = await page.locator('h1').all();
    console.log('🎯 Found h1 elements:', h1Elements.length);
    for (const h1 of h1Elements) {
      const text = await h1.textContent();
      console.log('  - h1 text:', text);
    }
    
    // Check for any buttons
    const buttons = await page.locator('button').all();
    console.log('🔘 Found buttons:', buttons.length);
    for (const button of buttons) {
      const text = await button.textContent();
      console.log('  - button text:', text);
    }
    
    // Check for any cards
    const cards = await page.locator('[class*="card"]').all();
    console.log('📋 Found card elements:', cards.length);
    
    // Check for any error messages
    const errors = await page.locator('[class*="error"]').all();
    console.log('❌ Found error elements:', errors.length);
    
    console.log('✅ Debug completed!');
  });
});