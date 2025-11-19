import { test, expect } from '@playwright/test';

const LIBRARIAN_CREDENTIALS = {
  username: 'librarian',
  password: 'password123',
};

test.describe('🔍 Debug Enhanced Library Tabs', () => {
  test('should find enhanced library tabs on dashboard', async ({ page }) => {
    // Navigate to login page with correct port
    await page.goto('http://localhost:3002');

    // Login as librarian
    await page.fill('input[name="username"]', LIBRARIAN_CREDENTIALS.username);
    await page.fill('input[name="password"]', LIBRARIAN_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load - be more flexible with URL
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give extra time for navigation

    // Take a screenshot to see what's visible
    await page.screenshot({ path: 'debug-dashboard-actual.png', fullPage: true });

    // Check if enhanced library tabs exist in DOM
    const enhancedTabs = [
      'User Tracking',
      'Enhanced Borrowing', 
      'Overdue Management',
      'Library Analytics'
    ];

    console.log('🔍 Searching for enhanced library tabs...');

    // Check all tabs in the DOM
    const allTabs = await page.locator('[role="tab"]').allTextContents();
    console.log('📋 All tab texts found:', allTabs);

    // Check mobile tabs
    const mobileTabs = await page.locator('.lg\\:hidden [role="tab"]').allTextContents();
    console.log('📱 Mobile tab texts:', mobileTabs);

    // Check desktop tabs
    const desktopTabs = await page.locator('.hidden.lg\\:block [role="tab"]').allTextContents();
    console.log('🖥️ Desktop tab texts:', desktopTabs);

    // Check all buttons
    const allButtons = await page.locator('button').allTextContents();
    console.log('🔘 All button texts:', allButtons);

    // Look for enhanced library tabs specifically
    for (const tabName of enhancedTabs) {
      // Try multiple selectors
      const selectors = [
        `button:has-text("${tabName}")`,
        `[role="tab"]:has-text("${tabName}")`,
        `text="${tabName}"`
      ];

      let found = false;
      for (const selector of selectors) {
        try {
          const element = await page.locator(selector);
          const count = await element.count();
          if (count > 0) {
            const isVisible = await element.first().isVisible();
            const isEnabled = await element.first().isEnabled();
            console.log(`✅ Found "${tabName}" with selector: ${selector} (visible: ${isVisible}, enabled: ${isEnabled})`);
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

    // Test if we can find any of the enhanced library content
    const enhancedContent = [
      'Current Patrons',
      'Select Student',
      'Overdue Books',
      'Top Users'
    ];

    for (const content of enhancedContent) {
      try {
        const element = await page.locator(`text="${content}"`);
        const count = await element.count();
        if (count > 0) {
          console.log(`✅ Found enhanced library content: "${content}"`);
        }
      } catch (error) {
        console.log(`❌ Could not find content: "${content}"`);
      }
    }
  });

  test('should manually navigate to enhanced library tabs', async ({ page }) => {
    await page.goto('http://localhost:3002');

    // Login
    await page.fill('input[name="username"]', LIBRARIAN_CREDENTIALS.username);
    await page.fill('input[name="password"]', LIBRARIAN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to navigate by setting the active tab directly
    console.log('🧪 Testing direct tab navigation...');
    
    // Try clicking on User Tracking tab
    try {
      await page.evaluate(() => {
        // Find the User Tracking tab and click it
        const tabs = document.querySelectorAll('[role="tab"]');
        tabs.forEach(tab => {
          if (tab.textContent?.includes('User Tracking')) {
            (tab as HTMLElement).click();
          }
        });
      });
      
      await page.waitForTimeout(1000);
      
      // Check if User Tracking content is visible
      const userTrackingContent = await page.locator('text="Current Patrons"').count();
      if (userTrackingContent > 0) {
        console.log('✅ User Tracking tab is working!');
      } else {
        console.log('❌ User Tracking content not found after navigation');
      }
    } catch (error) {
      console.log('❌ Could not navigate to User Tracking tab:', error.message);
    }

    // Take final screenshot
    await page.screenshot({ path: 'debug-enhanced-tabs-final.png', fullPage: true });
  });
});