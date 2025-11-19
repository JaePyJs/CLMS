import { test, expect } from '@playwright/test';

const LIBRARIAN_CREDENTIALS = {
  username: 'librarian',
  password: 'password123',
};

test.describe('🔍 Debug Enhanced Library Tabs', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/');

    // Login as librarian
    await page.fill('input[name="username"]', LIBRARIAN_CREDENTIALS.username);
    await page.fill('input[name="password"]', LIBRARIAN_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('should find all enhanced library tabs', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForTimeout(2000);

    // Take a screenshot to see what's visible
    await page.screenshot({ path: 'debug-dashboard.png', fullPage: true });

    // Check if enhanced library tabs exist in DOM
    const enhancedTabs = [
      'User Tracking',
      'Enhanced Borrowing',
      'Overdue Management',
      'Library Analytics',
    ];

    console.log('🔍 Searching for enhanced library tabs...');

    for (const tabName of enhancedTabs) {
      // Try multiple selectors
      const selectors = [
        `button:has-text("${tabName}")`,
        `[role="tab"]:has-text("${tabName}")`,
        `text="${tabName}"`,
        `[data-testid*="${tabName.toLowerCase().replace(' ', '-')}"]`,
      ];

      let found = false;
      for (const selector of selectors) {
        try {
          const element = await page.locator(selector);
          const count = await element.count();
          if (count > 0) {
            const isVisible = await element.first().isVisible();
            const isEnabled = await element.first().isEnabled();
            console.log(
              `✅ Found "${tabName}" with selector: ${selector} (visible: ${isVisible}, enabled: ${isEnabled})`
            );
            found = true;
            break;
          }
        } catch (error) {
          console.log(`❌ Selector "${selector}" failed: ${error.message}`);
        }
      }

      if (!found) {
        console.log(`❌ Could not find tab: "${tabName}"`);
      }
    }

    // Check what's actually in the DOM
    const allButtons = await page.locator('button').allTextContents();
    console.log('📋 All button texts found:', allButtons);

    const allTabs = await page.locator('[role="tab"]').allTextContents();
    console.log('📋 All tab texts found:', allTabs);

    // Check if tabs are in mobile view
    const mobileTabs = await page
      .locator('.lg\\:hidden button')
      .allTextContents();
    console.log('📱 Mobile tab texts:', mobileTabs);

    const desktopTabs = await page
      .locator('.hidden.lg\\:block button')
      .allTextContents();
    console.log('🖥️ Desktop tab texts:', desktopTabs);
  });

  test('should check for JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    console.log('🐛 JavaScript errors found:', errors);

    // Check if enhanced library components are loading
    const enhancedComponents = [
      'UserTracking',
      'EnhancedBorrowing',
      'OverdueManagement',
      'LibraryAnalytics',
    ];

    for (const component of enhancedComponents) {
      const element = await page.locator(`text=${component}`);
      const count = await element.count();
      console.log(`🔍 Component "${component}" found ${count} times`);
    }
  });
});