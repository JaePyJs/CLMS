import { test, expect } from '@playwright/test';

test.describe('🎯 Kiosk Interface - Detailed Debug', () => {
  test('🔍 Check exact HTML structure of kiosk', async ({ page }) => {
    console.log('🚀 Navigating to kiosk interface...');
    
    await page.goto('http://localhost:3000/kiosk');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'kiosk-detailed-debug.png', fullPage: true });
    
    console.log('🔍 Analyzing HTML structure...');
    
    // Get all heading elements
    const headings = await page.evaluate(() => {
      const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"]');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        classes: el.className
      }));
    });
    
    console.log('📋 Found headings:', headings);
    
    // Get all button elements
    const buttons = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, [role="button"]');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        classes: el.className,
        type: (el as HTMLButtonElement).type
      }));
    });
    
    console.log('🔘 Found buttons:', buttons);
    
    // Find the welcome text specifically
    const welcomeText = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const results = [];
      for (const el of elements) {
        if (el.textContent?.includes('Welcome to the Library')) {
          results.push({
            tag: el.tagName,
            text: el.textContent.trim(),
            classes: el.className,
            parent: el.parentElement?.tagName
          });
        }
      }
      return results;
    });
    
    console.log('🎯 Found welcome text elements:', welcomeText);
    
    // Find "Tap Your ID" text
    const tapText = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const results = [];
      for (const el of elements) {
        if (el.textContent?.includes('Tap Your ID')) {
          results.push({
            tag: el.tagName,
            text: el.textContent.trim(),
            classes: el.className,
            parent: el.parentElement?.tagName
          });
        }
      }
      return results;
    });
    
    console.log('🎯 Found "Tap Your ID" text elements:', tapText);
    
    console.log('✅ Detailed debug completed!');
  });
});