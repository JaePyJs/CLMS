import { test, expect } from '@playwright/test';

const LIBRARIAN_CREDENTIALS = {
  username: 'librarian',
  password: 'password123',
};

test.describe('🔍 Manual Enhanced Library Tab Check', () => {
  test('should manually verify enhanced library tabs exist', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3002');

    // Wait for login page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot of login page
    await page.screenshot({ path: 'debug-login-page.png', fullPage: true });

    // Login as librarian
    await page.fill('input[name="username"]', LIBRARIAN_CREDENTIALS.username);
    await page.fill('input[name="password"]', LIBRARIAN_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Wait for navigation - be flexible about the URL
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give extra time for navigation

    // Take screenshot after login
    await page.screenshot({ path: 'debug-after-login.png', fullPage: true });

    // Check the current URL
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);

    // Look for enhanced library tabs in the DOM
    const enhancedTabs = [
      'User Tracking',
      'Enhanced Borrowing',
      'Overdue Management',
      'Library Analytics'
    ];

    console.log('🔍 Searching for enhanced library tabs in DOM...');

    // Check all elements that could be tabs
    const allTabElements = await page.locator('[role="tab"], button').all();
    console.log(`📊 Found ${allTabElements.length} tab/button elements`);

    for (let i = 0; i < allTabElements.length; i++) {
      try {
        const element = allTabElements[i];
        const text = await element.textContent();
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();
        
        if (text && text.trim()) {
          console.log(`🔍 Element ${i}: "${text.trim()}" (visible: ${isVisible}, enabled: ${isEnabled})`);
          
          // Check if this is one of our enhanced library tabs
          const matchingTab = enhancedTabs.find(tab => text.includes(tab));
          if (matchingTab) {
            console.log(`✅ FOUND ENHANCED TAB: "${matchingTab}"`);
          }
        }
      } catch (error) {
        console.log(`❌ Error checking element ${i}:`, error.message);
      }
    }

    // Check if we're on the dashboard by looking for dashboard content
    const dashboardContent = await page.locator('text="Dashboard Overview"').count();
    const welcomeText = await page.locator('text="Welcome"').count();
    console.log(`📊 Dashboard content found: ${dashboardContent}, Welcome text: ${welcomeText}`);

    // Try to find any content that suggests we're logged in
    const loggedInIndicators = [
      'Dashboard',
      'Students',
      'Books',
      'Checkout',
      'Settings',
      'librarian'
    ];

    for (const indicator of loggedInIndicators) {
      const count = await page.locator(`text="${indicator}"`).count();
      if (count > 0) {
        console.log(`✅ Logged in indicator found: "${indicator}" (${count} times)`);
      }
    }

    // Final screenshot
    await page.screenshot({ path: 'debug-final-state.png', fullPage: true });
  });

  test('should check if enhanced library components render manually', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3002');
    await page.fill('input[name="username"]', LIBRARIAN_CREDENTIALS.username);
    await page.fill('input[name="password"]', LIBRARIAN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Try to manually set the active tab to user-tracking
    console.log('🧪 Attempting to manually activate user-tracking tab...');
    
    try {
      await page.evaluate(() => {
        // Look for the user-tracking tab and click it
        const tabs = document.querySelectorAll('[role="tab"]');
        console.log('Found tabs:', tabs.length);
        
        tabs.forEach((tab, index) => {
          console.log(`Tab ${index}:`, tab.textContent, tab.getAttribute('value'));
          if (tab.textContent?.includes('User Tracking') || tab.getAttribute('value') === 'user-tracking') {
            console.log('Clicking User Tracking tab');
            (tab as HTMLElement).click();
          }
        });
      });
      
      await page.waitForTimeout(2000);
      
      // Check if User Tracking content appears
      const userTrackingContent = await page.locator('text="Current Patrons"').count();
      console.log(`User Tracking content found: ${userTrackingContent}`);
      
      if (userTrackingContent > 0) {
        console.log('✅ User Tracking component is working!');
      } else {
        console.log('❌ User Tracking component did not render');
      }
      
    } catch (error) {
      console.log('❌ Error during manual tab activation:', error.message);
    }

    // Take screenshot after manual attempt
    await page.screenshot({ path: 'debug-manual-attempt.png', fullPage: true });
  });
});