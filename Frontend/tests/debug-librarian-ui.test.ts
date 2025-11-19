import { test, expect } from '@playwright/test';
import { setupCLMSTestEnvironment, cleanupAfterCLMSTests } from './test-utils';

test.describe('Debug Librarian Dashboard UI', () => {
  test.beforeAll(async () => {
    await setupCLMSTestEnvironment();
  });

  test.afterAll(async () => {
    await cleanupAfterCLMSTests();
  });

  test('capture actual librarian dashboard structure', async ({ page }) => {
    console.log('🚀 Starting librarian dashboard analysis...');
    
    // Navigate to the frontend
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    console.log('📍 Current URL:', page.url());
    
    // Login as librarian
    const loginForm = page.locator('[data-testid="login-form"]');
    const isLoginVisible = await loginForm.isVisible();
    
    if (isLoginVisible) {
      console.log('📝 Logging in as librarian...');
      
      await page.fill('input[name="username"]', 'librarian');
      await page.fill('input[name="password"]', 'lib123');
      
      await page.click('button[type="submit"]');
      
      // Wait for login to complete
      await page.waitForTimeout(3000);
    }
    
    console.log('📍 URL after login:', page.url());
    
    // Capture the full page structure
    const pageContent = await page.content();
    console.log('📄 Full page content length:', pageContent.length);
    
    // Look for key UI elements
    const selectors = [
      'nav', '.navigation', '.sidebar', '.menu', '.dashboard',
      '[data-testid*="nav"]', '[data-testid*="menu"]', '[data-testid*="dashboard"]',
      '.tab', '.button', '.link', 'a', 'button',
      '.metric', '.card', '.widget', '.stats', '.chart'
    ];
    
    console.log('\n🔍 UI Element Analysis:');
    for (const selector of selectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`  ${selector}: ${elements.length} elements found`);
          
          // Get text content of first few elements
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const text = await elements[i].textContent().catch(() => '');
            const className = await elements[i].getAttribute('class').catch(() => '');
            console.log(`    [${i}] Text: "${text?.trim().substring(0, 50)}..." | Class: ${className?.substring(0, 50)}`);
          }
        }
      } catch (error) {
        // Silently continue if selector fails
      }
    }
    
    // Take screenshots for visual analysis
    await page.screenshot({ path: 'librarian-dashboard-full.png', fullPage: true });
    
    // Try to find navigation structure
    console.log('\n🧭 Navigation Structure:');
    const navElements = await page.locator('nav *, .navigation *, .sidebar *').all();
    console.log(`  Total navigation elements: ${navElements.length}`);
    
    // Look for specific navigation items
    const navTextSelectors = ['Home', 'Dashboard', 'Students', 'Books', 'Catalog', 'Reports', 'Settings', 'Logout'];
    for (const text of navTextSelectors) {
      try {
        const element = await page.locator(`text="${text}"`).first();
        if (await element.isVisible()) {
          console.log(`  ✅ Found: ${text}`);
        }
      } catch (error) {
        console.log(`  ❌ Not found: ${text}`);
      }
    }
    
    // Check for tab-based navigation (since we saw tabs in previous tests)
    console.log('\n📑 Tab Structure:');
    const tabs = await page.locator('.tab, [role="tab"], .nav-tab').all();
    console.log(`  Total tabs: ${tabs.length}`);
    
    for (let i = 0; i < tabs.length; i++) {
      try {
        const text = await tabs[i].textContent();
        const isActive = await tabs[i].getAttribute('aria-selected').catch(() => 'false');
        console.log(`  Tab ${i}: "${text?.trim()}" (active: ${isActive})`);
      } catch (error) {
        // Continue
      }
    }
    
    console.log('\n📸 Screenshots saved: librarian-dashboard-full.png');
    console.log('✅ Librarian dashboard analysis complete!');
  });
});