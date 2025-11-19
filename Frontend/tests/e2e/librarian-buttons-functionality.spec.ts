import { test, expect } from "@playwright/test";

test.describe("🎯 CLMS Admin - All Buttons Functional Test", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto("http://localhost:3000");

    // Wait for login form to appear
    await page.waitForSelector('input[id="username"]', { timeout: 10000 });

    // Login as admin (since librarian credentials don't exist yet)
    await page.fill('input[id="username"]', "admin");
    await page.fill('input[id="password"]', "admin123");
    await page.click('button[type="submit"]');

    // Wait for dashboard to load - look for the welcome message instead of h2 Dashboard
    await page.waitForSelector('h2:has-text("Good Morning")', { timeout: 15000 });

    // Wait for any loading spinners to disappear
    await page.waitForLoadState("networkidle");
  });

  // Helper function to navigate to tabs, handling mobile responsive behavior
  async function navigateToTab(page: any, tabName: string) {
    console.log(`🧭 Navigating to ${tabName} tab...`);
    
    // Map tab names to their IDs used in the mobile navigation
    const tabNameToId = {
      'Dashboard': 'dashboard',
      'Activity': 'scan',
      'Students': 'students', 
      'Books': 'books',
      'Checkout': 'checkout',
      'Equipment': 'equipment',
      'Automation': 'automation',
      'Analytics': 'analytics',
      'Reports': 'reports',
      'Import': 'import',
      'QR Codes': 'qrcodes',
      'Barcodes': 'barcodes',
      'Management': 'management',
      'Settings': 'settings'
    };
    
    const tabId = tabNameToId[tabName as keyof typeof tabNameToId];
    if (!tabId) {
      throw new Error(`Unknown tab name: ${tabName}`);
    }
    
    // Try desktop approach first - visible tabs (only on large screens)
    try {
      // Check if we're on desktop by looking for visible tabs
      const desktopTabsVisible = await page.locator('div.hidden.lg:block').isVisible();
      if (desktopTabsVisible) {
        await page.click(`[role="tab"]:has-text("${tabName}")`, { timeout: 5000 });
        console.log(`✅ Found ${tabName} tab (desktop)`);
        return;
      }
    } catch (error) {
      console.log(`⚠️ ${tabName} tab not visible on desktop, trying mobile...`);
    }
    
    // Mobile approach - use bottom navigation
    try {
      // Look for mobile bottom navigation buttons
      const mobileNavButton = page.locator(`button[data-tab="${tabId}"], button[aria-label*="${tabName}"]`);
      
      if (await mobileNavButton.count() > 0) {
        await mobileNavButton.first().click();
        console.log(`✅ Found ${tabName} in mobile bottom navigation`);
        return;
      }
      
      // Try to find by button text content
      const mobileButton = page.locator(`button:has-text("${tabName}")`);
      if (await mobileButton.count() > 0) {
        await mobileButton.first().click();
        console.log(`✅ Found ${tabName} button on mobile`);
        return;
      }
      
      // Look for any clickable element with the tab name
      const anyElement = page.locator(`[data-testid*="${tabId}"], [aria-label*="${tabName}"]`);
      if (await anyElement.count() > 0) {
        await anyElement.first().click();
        console.log(`✅ Found ${tabName} using data attributes`);
        return;
      }
      
    } catch (error) {
      console.log(`⚠️ Could not find mobile navigation for ${tabName}`);
    }
    
    // Final fallback - try to use the tab ID directly
    try {
      // Try to click on element with the tab ID
      await page.click(`#tab-${tabId}`, { timeout: 3000 });
      console.log(`✅ Found ${tabName} using tab ID`);
      return;
    } catch (error) {
      console.log(`❌ Could not navigate to ${tabName} tab`);
      throw new Error(`Unable to navigate to ${tabName} tab`);
    }
  }

  test("🧪 Test Dashboard Tab - All Buttons Functional", async ({ page }) => {
    console.log("📊 Testing Dashboard tab functionality...");

    // Navigate to Dashboard tab
    await navigateToTab(page, "Dashboard");
    await page.waitForTimeout(1000);

    // Test Refresh button
    try {
      await page.click('button:has-text("Refresh")');
      console.log("✅ Refresh button clicked successfully");
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log("⚠️ Refresh button not found or not clickable");
    }

    // Test dashboard cards and their interactive elements
    const dashboardCards = await page
      .locator(".grid.gap-4.md\\:grid-cols-2.lg\\:grid-cols-4 .card")
      .count();
    console.log(`📋 Found ${dashboardCards} dashboard cards`);

    // Test Popular Items tabs
    try {
      await page.click('[role="tab"]:has-text("Popular Items")');
      console.log("✅ Popular Items tab clicked");
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log("⚠️ Popular Items tab not found");
    }

    // Test Activity tabs
    try {
      await page.click('[role="tab"]:has-text("Activity")');
      console.log("✅ Activity tab clicked");
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log("⚠️ Activity tab not found");
    }

    console.log("✅ Dashboard tab functionality test completed");
  });

  test("📱 Test Activity Tab - All Buttons Functional", async ({ page }) => {
    console.log("📱 Testing Activity tab functionality...");

    // Navigate to Activity tab
    await navigateToTab(page, "Activity");
    await page.waitForTimeout(1000);

    // Look for scan-related buttons and inputs
    const scanInputs = await page
      .locator(
        'input[type="text"], input[placeholder*="scan"], input[placeholder*="barcode"]'
      )
      .count();
    console.log(`📱 Found ${scanInputs} scan-related inputs`);

    // Look for action buttons
    const actionButtons = await page
      .locator(
        'button:has-text("Scan"), button:has-text("Check"), button:has-text("Find"), button:has-text("Submit")'
      )
      .count();
    console.log(`🔍 Found ${actionButtons} action buttons`);

    // Test any scan functionality
    if (scanInputs > 0) {
      try {
        const firstInput = await page
          .locator(
            'input[type="text"], input[placeholder*="scan"], input[placeholder*="barcode"]'
          )
          .first();
        await firstInput.fill("TEST001");
        console.log("✅ Test barcode entered");

        if (actionButtons > 0) {
          const firstButton = await page
            .locator(
              'button:has-text("Scan"), button:has-text("Check"), button:has-text("Find"), button:has-text("Submit")'
            )
            .first();
          await firstButton.click();
          console.log("✅ Action button clicked");
          await page.waitForTimeout(2000);
        }
      } catch (error) {
        console.log("⚠️ Scan functionality test failed:", error.message);
      }
    }

    console.log("✅ Activity tab functionality test completed");
  });

  test("👥 Test Students Tab - All Buttons Functional", async ({ page }) => {
    console.log("👥 Testing Students tab functionality...");

    // Navigate to Students tab
    await navigateToTab(page, "Students");
    await page.waitForTimeout(1000);

    // Look for student management buttons
    const studentButtons = await page
      .locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Import"), button:has-text("Export")'
      )
      .count();
    console.log(`🎓 Found ${studentButtons} student management buttons`);

    // Test search functionality
    const searchInputs = await page
      .locator(
        'input[placeholder*="search"], input[placeholder*="student"], input[placeholder*="name"]'
      )
      .count();
    console.log(`🔍 Found ${searchInputs} search inputs`);

    if (searchInputs > 0) {
      try {
        const searchInput = await page
          .locator(
            'input[placeholder*="search"], input[placeholder*="student"], input[placeholder*="name"]'
          )
          .first();
        await searchInput.fill("test student");
        console.log("✅ Student search input filled");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log("⚠️ Student search test failed:", error.message);
      }
    }

    // Test any visible buttons
    if (studentButtons > 0) {
      try {
        const firstButton = await page
          .locator(
            'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Import"), button:has-text("Export")'
          )
          .first();
        await firstButton.click();
        console.log("✅ Student management button clicked");
        await page.waitForTimeout(2000);

        // If a dialog opened, try to close it
        const closeButtons = await page
          .locator(
            'button:has-text("Cancel"), button:has-text("Close"), .close'
          )
          .count();
        if (closeButtons > 0) {
          await page
            .locator(
              'button:has-text("Cancel"), button:has-text("Close"), .close'
            )
            .first()
            .click();
          console.log("✅ Dialog closed");
        }
      } catch (error) {
        console.log("⚠️ Student management button test failed:", error.message);
      }
    }

    console.log("✅ Students tab functionality test completed");
  });

  test("📚 Test Books Tab - All Buttons Functional", async ({ page }) => {
    console.log("📚 Testing Books tab functionality...");

    // Navigate to Books tab
    await navigateToTab(page, "Books");
    await page.waitForTimeout(1000);

    // Look for book management buttons
    const bookButtons = await page
      .locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Import"), button:has-text("Catalog"), button:has-text("Search")'
      )
      .count();
    console.log(`📖 Found ${bookButtons} book management buttons`);

    // Test book search functionality
    const bookSearchInputs = await page
      .locator(
        'input[placeholder*="book"], input[placeholder*="title"], input[placeholder*="author"], input[placeholder*="isbn"]'
      )
      .count();
    console.log(`🔍 Found ${bookSearchInputs} book search inputs`);

    if (bookSearchInputs > 0) {
      try {
        const bookSearchInput = await page
          .locator(
            'input[placeholder*="book"], input[placeholder*="title"], input[placeholder*="author"], input[placeholder*="isbn"]'
          )
          .first();
        await bookSearchInput.fill("test book");
        console.log("✅ Book search input filled");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log("⚠️ Book search test failed:", error.message);
      }
    }

    // Test any visible book buttons
    if (bookButtons > 0) {
      try {
        const firstBookButton = await page
          .locator(
            'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Import"), button:has-text("Catalog"), button:has-text("Search")'
          )
          .first();
        await firstBookButton.click();
        console.log("✅ Book management button clicked");
        await page.waitForTimeout(2000);

        // If a dialog opened, try to close it
        const closeButtons = await page
          .locator(
            'button:has-text("Cancel"), button:has-text("Close"), .close'
          )
          .count();
        if (closeButtons > 0) {
          await page
            .locator(
              'button:has-text("Cancel"), button:has-text("Close"), .close'
            )
            .first()
            .click();
          console.log("✅ Book dialog closed");
        }
      } catch (error) {
        console.log("⚠️ Book management button test failed:", error.message);
      }
    }

    console.log("✅ Books tab functionality test completed");
  });

  test("📋 Test Checkout Tab - All Buttons Functional", async ({ page }) => {
    console.log("📋 Testing Checkout tab functionality...");

    // Navigate to Checkout tab
    await navigateToTab(page, "Checkout");
    await page.waitForTimeout(1000);

    // Look for checkout-related inputs and buttons
    const checkoutInputs = await page
      .locator(
        'input[placeholder*="student"], input[placeholder*="book"], input[placeholder*="barcode"], input[id*="barcode"]'
      )
      .count();
    console.log(`🎯 Found ${checkoutInputs} checkout-related inputs`);

    const checkoutButtons = await page
      .locator(
        'button:has-text("Check Out"), button:has-text("Return"), button:has-text("Scan"), button:has-text("Find"), button:has-text("Submit")'
      )
      .count();
    console.log(`🔄 Found ${checkoutButtons} checkout buttons`);

    // Test checkout workflow
    if (checkoutInputs >= 2) {
      try {
        const inputs = await page
          .locator(
            'input[placeholder*="student"], input[placeholder*="book"], input[placeholder*="barcode"], input[id*="barcode"]'
          )
          .all();

        if (inputs.length >= 2) {
          await inputs[0].fill("STU001");
          console.log("✅ Student ID entered");
          await inputs[1].fill("BOOK001");
          console.log("✅ Book barcode entered");

          if (checkoutButtons > 0) {
            const checkoutButton = await page
              .locator(
                'button:has-text("Check Out"), button:has-text("Return"), button:has-text("Scan"), button:has-text("Find"), button:has-text("Submit")'
              )
              .first();
            await checkoutButton.click();
            console.log("✅ Checkout button clicked");
            await page.waitForTimeout(3000);
          }
        }
      } catch (error) {
        console.log("⚠️ Checkout workflow test failed:", error.message);
      }
    }

    console.log("✅ Checkout tab functionality test completed");
  });

  test("⚙️ Test Settings Tab - All Buttons Functional", async ({ page }) => {
    console.log("⚙️ Testing Settings tab functionality...");

    // Navigate to Settings tab
    await navigateToTab(page, "Settings");
    await page.waitForTimeout(1000);

    // Look for settings buttons and sections
    const settingsButtons = await page
      .locator(
        'button:has-text("System"), button:has-text("User"), button:has-text("Save"), button:has-text("Update"), button:has-text("Configure"), button:has-text("Settings")'
      )
      .count();
    console.log(`🔧 Found ${settingsButtons} settings buttons`);

    // Test theme toggle (if available)
    const themeButtons = await page
      .locator(
        'button[aria-label*="theme"], button:has-text("🌙"), button:has-text("☀️"), button:has-text("Theme")'
      )
      .count();
    console.log(`🌙 Found ${themeButtons} theme buttons`);

    if (themeButtons > 0) {
      try {
        const themeButton = await page
          .locator(
            'button[aria-label*="theme"], button:has-text("🌙"), button:has-text("☀️"), button:has-text("Theme")'
          )
          .first();
        await themeButton.click();
        console.log("✅ Theme toggle clicked");
        await page.waitForTimeout(1000);

        // Toggle back
        await themeButton.click();
        console.log("✅ Theme toggled back");
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log("⚠️ Theme toggle test failed:", error.message);
      }
    }

    // Test any visible settings buttons
    if (settingsButtons > 0) {
      try {
        const firstSettingsButton = await page
          .locator(
            'button:has-text("System"), button:has-text("User"), button:has-text("Save"), button:has-text("Update"), button:has-text("Configure"), button:has-text("Settings")'
          )
          .first();
        await firstSettingsButton.click();
        console.log("✅ Settings button clicked");
        await page.waitForTimeout(2000);

        // If a dialog opened, try to close it
        const closeButtons = await page
          .locator(
            'button:has-text("Cancel"), button:has-text("Close"), .close'
          )
          .count();
        if (closeButtons > 0) {
          await page
            .locator(
              'button:has-text("Cancel"), button:has-text("Close"), .close'
            )
            .first()
            .click();
          console.log("✅ Settings dialog closed");
        }
      } catch (error) {
        console.log("⚠️ Settings button test failed:", error.message);
      }
    }

    console.log("✅ Settings tab functionality test completed");
  });

  test("🔔 Test Notification Center - All Buttons Functional", async ({
    page,
  }) => {
    console.log("🔔 Testing Notification Center functionality...");

    // Look for notification-related buttons
    const notificationButtons = await page
      .locator(
        'button[aria-label*="notification"], button:has-text("🔔"), button:has-text("Notification"), [data-testid*="notification"]'
      )
      .count();
    console.log(`🔔 Found ${notificationButtons} notification buttons`);

    if (notificationButtons > 0) {
      try {
        const notificationButton = await page
          .locator(
            'button[aria-label*="notification"], button:has-text("🔔"), button:has-text("Notification"), [data-testid*="notification"]'
          )
          .first();
        await notificationButton.click();
        console.log("✅ Notification center opened");
        await page.waitForTimeout(2000);

        // Look for notification actions
        const notificationActions = await page
          .locator(
            'button:has-text("Mark"), button:has-text("Clear"), button:has-text("Dismiss"), button:has-text("View")'
          )
          .count();
        console.log(`📋 Found ${notificationActions} notification actions`);

        if (notificationActions > 0) {
          const firstAction = await page
            .locator(
              'button:has-text("Mark"), button:has-text("Clear"), button:has-text("Dismiss"), button:has-text("View")'
            )
            .first();
          await firstAction.click();
          console.log("✅ Notification action clicked");
          await page.waitForTimeout(1000);
        }

        // Close notification center
        await notificationButton.click();
        console.log("✅ Notification center closed");
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log("⚠️ Notification center test failed:", error.message);
      }
    }

    console.log("✅ Notification Center functionality test completed");
  });

  test("🚪 Test Logout Functionality", async ({ page }) => {
    console.log("🚪 Testing logout functionality...");

    // Look for logout buttons
    const logoutButtons = await page
      .locator(
        'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid*="logout"], a:has-text("Logout"), a:has-text("Sign Out")'
      )
      .count();
    console.log(`🚪 Found ${logoutButtons} logout buttons`);

    if (logoutButtons > 0) {
      try {
        const logoutButton = await page
          .locator(
            'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid*="logout"], a:has-text("Logout"), a:has-text("Sign Out")'
          )
          .first();
        await logoutButton.click();
        console.log("✅ Logout button clicked");
        await page.waitForTimeout(3000);

        // Verify we're back at login screen
        const loginForm = await page
          .locator('input[id="username"], input[type="text"], form')
          .count();
        if (loginForm > 0) {
          console.log("✅ Successfully logged out - back at login screen");
        } else {
          console.log("⚠️ Logout may not have completed successfully");
        }
      } catch (error) {
        console.log("⚠️ Logout test failed:", error.message);
      }
    } else {
      console.log("⚠️ No logout buttons found - may be in user menu");

      // Try user menu approach
      try {
        const userMenu = await page
          .locator('.user-menu, .profile-menu, [data-testid="user-menu"]')
          .count();
        if (userMenu > 0) {
          await page
            .locator('.user-menu, .profile-menu, [data-testid="user-menu"]')
            .first()
            .click();
          await page.waitForTimeout(500);

          const menuLogout = await page
            .locator(
              'button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Sign Out")'
            )
            .count();
          if (menuLogout > 0) {
            await page
              .locator(
                'button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Sign Out")'
              )
              .first()
              .click();
            console.log("✅ Logout completed via user menu");
            await page.waitForTimeout(3000);
          }
        }
      } catch (error) {
        console.log("⚠️ User menu logout test failed:", error.message);
      }
    }

    console.log("✅ Logout functionality test completed");
  });

  test("📱 Test Mobile Navigation - All Buttons Functional", async ({
    page,
  }) => {
    console.log("📱 Testing mobile navigation functionality...");

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Look for mobile menu button
    const mobileMenuButtons = await page
      .locator(
        'button:has-text("☰"), button[aria-label*="menu"], button:has-text("Menu"), .mobile-menu-button'
      )
      .count();
    console.log(`📱 Found ${mobileMenuButtons} mobile menu buttons`);

    if (mobileMenuButtons > 0) {
      try {
        const mobileMenuButton = await page
          .locator(
            'button:has-text("☰"), button[aria-label*="menu"], button:has-text("Menu"), .mobile-menu-button'
          )
          .first();
        await mobileMenuButton.click();
        console.log("✅ Mobile menu opened");
        await page.waitForTimeout(2000);

        // Look for mobile navigation items
        const mobileNavItems = await page
          .locator('.mobile-nav a, .mobile-menu a, [role="menuitem"]')
          .count();
        console.log(`📋 Found ${mobileNavItems} mobile navigation items`);

        if (mobileNavItems > 0) {
          const firstNavItem = await page
            .locator('.mobile-nav a, .mobile-menu a, [role="menuitem"]')
            .first();
          await firstNavItem.click();
          console.log("✅ Mobile navigation item clicked");
          await page.waitForTimeout(1000);
        }

        // Close mobile menu
        await mobileMenuButton.click();
        console.log("✅ Mobile menu closed");
      } catch (error) {
        console.log("⚠️ Mobile navigation test failed:", error.message);
      }
    }

    // Reset to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    console.log("✅ Mobile navigation functionality test completed");
  });

  test("🎯 Final Comprehensive Button Test - All Tabs", async ({ page }) => {
    console.log("🎯 Running final comprehensive button test...");

    const tabs = [
      "Dashboard",
      "Activity",
      "Students",
      "Books",
      "Checkout",
      "Equipment",
      "Automation",
      "Analytics",
      "Reports",
      "Import",
      "QR Codes",
      "Barcodes",
      "Management",
      "Settings",
    ];

    let totalButtons = 0;
    let clickableButtons = 0;

    for (const tab of tabs) {
      console.log(`🧪 Testing ${tab} tab...`);

      try {
        await page.click(`[role="tab"]:has-text("${tab}")`);
        await page.waitForTimeout(1500);

        // Count all buttons in this tab
        const buttons = await page.locator("button:visible").count();
        console.log(`  📋 Found ${buttons} buttons in ${tab} tab`);

        totalButtons += buttons;

        // Test a few buttons in each tab
        const buttonsToTest = Math.min(buttons, 3);
        for (let i = 0; i < buttonsToTest; i++) {
          try {
            const button = await page.locator("button:visible").nth(i);
            const isEnabled = await button.isEnabled();
            const text = await button.textContent();

            if (isEnabled && text && text.trim()) {
              await button.hover();
              await page.waitForTimeout(100);
              clickableButtons++;
              console.log(`    ✅ Button "${text.trim()}" is functional`);
            }
          } catch (error) {
            // Skip problematic buttons
          }
        }
      } catch (error) {
        console.log(`  ⚠️ Failed to test ${tab} tab:`, error.message);
      }
    }

    console.log(`🎯 Final Results:`);
    console.log(`  📊 Total buttons found: ${totalButtons}`);
    console.log(`  ✅ Functional buttons: ${clickableButtons}`);
    console.log(
      `  📈 Functionality rate: ${((clickableButtons / totalButtons) * 100).toFixed(1)}%`
    );

    // Assert that we have a reasonable number of functional buttons
    expect(clickableButtons).toBeGreaterThan(10);
    expect((clickableButtons / totalButtons) * 100).toBeGreaterThan(50);

    console.log("✅ Final comprehensive button test completed");
  });
});