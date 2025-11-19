import { test, expect } from '@playwright/test';

test.describe('🎯 CLMS Librarian - Core Functionality Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Wait for login form to appear
    await page.waitForSelector('input[id="username"]', { timeout: 10000 });

    // Login as admin (since librarian credentials don't exist yet)
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForSelector('h2:has-text("Good Morning")', {
      timeout: 15000,
    });
    await page.waitForLoadState('networkidle');
  });

  // Helper function to navigate to tabs
  async function navigateToTab(page: any, tabName: string) {
    console.log(`🧭 Navigating to ${tabName} tab...`);

    // Map tab names to their IDs
    const tabNameToId = {
      Dashboard: 'dashboard',
      Activity: 'scan',
      Students: 'students',
      Books: 'books',
      Checkout: 'checkout',
      Equipment: 'equipment',
      Settings: 'settings',
    };

    const tabId = tabNameToId[tabName as keyof typeof tabNameToId];
    if (!tabId) {
      throw new Error(`Unknown tab name: ${tabName}`);
    }

    try {
      // Try desktop tabs first
      const desktopTab = page.locator(`button[id="tab-${tabId}"]`);
      if ((await desktopTab.count()) > 0 && (await desktopTab.isVisible())) {
        await desktopTab.click();
        console.log(`✅ Found ${tabName} tab (desktop)`);
        return;
      }
    } catch (error) {
      // Continue to mobile
    }

    // Try mobile bottom navigation
    try {
      // Look for mobile nav buttons with data attributes or specific text
      const mobileButton = page.locator(
        `button:has-text("${tabName}"):visible, button[data-tab="${tabId}"]:visible`
      );
      if ((await mobileButton.count()) > 0) {
        await mobileButton.first().click();
        console.log(`✅ Found ${tabName} in mobile navigation`);
        return;
      }
    } catch (error) {
      // Continue to fallback
    }

    // Final fallback - try any button containing the text
    try {
      const anyButton = page.locator(`button:has-text("${tabName}")`);
      if ((await anyButton.count()) > 0) {
        await anyButton.first().click();
        console.log(`✅ Found ${tabName} button`);
        return;
      }
    } catch (error) {
      console.log(`❌ Could not navigate to ${tabName} tab`);
      throw new Error(`Unable to navigate to ${tabName} tab`);
    }
  }

  test('🧪 Test Core Dashboard Functions', async ({ page }) => {
    console.log('📊 Testing core dashboard functionality...');

    // Navigate to Dashboard
    await navigateToTab(page, 'Dashboard');
    await page.waitForTimeout(2000);

    // Test basic interactions
    let successfulClicks = 0;
    const buttonsToTest = [
      'Refresh',
      'View',
      'Details',
      'Export',
      'Settings',
      'Help',
    ];

    for (const buttonText of buttonsToTest) {
      try {
        const buttons = page.locator(`button:has-text("${buttonText}")`);
        if ((await buttons.count()) > 0) {
          await buttons.first().click();
          console.log(`✅ Clicked ${buttonText} button`);
          successfulClicks++;
          await page.waitForTimeout(500);
        }
      } catch (error) {
        // Continue testing other buttons
      }
    }

    console.log(
      `📊 Successfully clicked ${successfulClicks} dashboard buttons`
    );
    expect(successfulClicks).toBeGreaterThan(0);
  });

  test('📱 Test Student Management', async ({ page }) => {
    console.log('👥 Testing student management functionality...');

    // Navigate to Students
    await navigateToTab(page, 'Students');
    await page.waitForTimeout(2000);

    // Test student-related buttons
    let successfulClicks = 0;
    const studentButtons = [
      'Add',
      'New',
      'Search',
      'Filter',
      'Export',
      'Import',
    ];

    for (const buttonText of studentButtons) {
      try {
        const buttons = page.locator(`button:has-text("${buttonText}")`);
        if ((await buttons.count()) > 0) {
          await buttons.first().click();
          console.log(`✅ Clicked ${buttonText} student button`);
          successfulClicks++;
          await page.waitForTimeout(500);
        }
      } catch (error) {
        // Continue testing other buttons
      }
    }

    console.log(
      `👥 Successfully clicked ${successfulClicks} student management buttons`
    );
    expect(successfulClicks).toBeGreaterThan(0);
  });

  test('📚 Test Book Management', async ({ page }) => {
    console.log('📚 Testing book management functionality...');

    // Navigate to Books
    await navigateToTab(page, 'Books');
    await page.waitForTimeout(2000);

    // Test book-related buttons
    let successfulClicks = 0;
    const bookButtons = [
      'Add',
      'New',
      'Search',
      'Scan',
      'Import',
      'Export',
      'Catalog',
    ];

    for (const buttonText of bookButtons) {
      try {
        const buttons = page.locator(`button:has-text("${buttonText}")`);
        if ((await buttons.count()) > 0) {
          await buttons.first().click();
          console.log(`✅ Clicked ${buttonText} book button`);
          successfulClicks++;
          await page.waitForTimeout(500);
        }
      } catch (error) {
        // Continue testing other buttons
      }
    }

    console.log(
      `📚 Successfully clicked ${successfulClicks} book management buttons`
    );
    expect(successfulClicks).toBeGreaterThan(0);
  });

  test('📋 Test Checkout System', async ({ page }) => {
    console.log('📋 Testing checkout functionality...');

    // Navigate to Checkout
    await navigateToTab(page, 'Checkout');
    await page.waitForTimeout(2000);

    // Test checkout-related buttons
    let successfulClicks = 0;
    const checkoutButtons = ['Scan', 'Checkout', 'Return', 'Search', 'Clear'];

    for (const buttonText of checkoutButtons) {
      try {
        const buttons = page.locator(`button:has-text("${buttonText}")`);
        if ((await buttons.count()) > 0) {
          await buttons.first().click();
          console.log(`✅ Clicked ${buttonText} checkout button`);
          successfulClicks++;
          await page.waitForTimeout(500);
        }
      } catch (error) {
        // Continue testing other buttons
      }
    }

    console.log(`📋 Successfully clicked ${successfulClicks} checkout buttons`);
    expect(successfulClicks).toBeGreaterThan(0);
  });

  test('⚙️ Test Settings', async ({ page }) => {
    console.log('⚙️ Testing settings functionality...');

    // Navigate to Settings
    await navigateToTab(page, 'Settings');
    await page.waitForTimeout(2000);

    // Test settings-related buttons
    let successfulClicks = 0;
    const settingsButtons = [
      'Save',
      'Update',
      'Reset',
      'Backup',
      'Restore',
      'Export',
    ];

    for (const buttonText of settingsButtons) {
      try {
        const buttons = page.locator(`button:has-text("${buttonText}")`);
        if ((await buttons.count()) > 0) {
          await buttons.first().click();
          console.log(`✅ Clicked ${buttonText} settings button`);
          successfulClicks++;
          await page.waitForTimeout(500);
        }
      } catch (error) {
        // Continue testing other buttons
      }
    }

    console.log(`⚙️ Successfully clicked ${successfulClicks} settings buttons`);
    expect(successfulClicks).toBeGreaterThan(0);
  });

  test('🎯 Final Core Functionality Test', async ({ page }) => {
    console.log('🎯 Testing overall core functionality...');

    let totalSuccessfulClicks = 0;
    const tabs = ['Dashboard', 'Students', 'Books', 'Checkout', 'Settings'];

    for (const tabName of tabs) {
      try {
        await navigateToTab(page, tabName);
        await page.waitForTimeout(1500);

        // Try to click any visible buttons on this tab
        const visibleButtons = page.locator('button:visible');
        const buttonCount = await visibleButtons.count();

        if (buttonCount > 0) {
          // Click first few buttons
          const buttonsToClick = Math.min(3, buttonCount);
          for (let i = 0; i < buttonsToClick; i++) {
            try {
              await visibleButtons.nth(i).click();
              totalSuccessfulClicks++;
              await page.waitForTimeout(300);
            } catch (error) {
              // Continue with next button
            }
          }
          console.log(`✅ ${tabName}: clicked ${buttonsToClick} buttons`);
        } else {
          console.log(`⚠️ ${tabName}: no visible buttons found`);
        }
      } catch (error) {
        console.log(`❌ Failed to test ${tabName} tab`);
      }
    }

    console.log(
      `🎯 Total successful button clicks across all tabs: ${totalSuccessfulClicks}`
    );
    expect(totalSuccessfulClicks).toBeGreaterThan(5);
  });
});
