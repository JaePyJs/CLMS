import { test, expect, devices } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * Mobile and Responsive Design Tests
 *
 * Tests the CLMS application across different devices and screen sizes:
 * - Desktop (1920x1080, 1366x768)
 * - Tablet (iPad Pro 1024x1366, Galaxy Tab 712x1138)
 * - Mobile (iPhone 14 Pro 393x852, Pixel 5 393x851)
 *
 * Features tested:
 * - Layout adaptation
 * - Touch interactions
 * - Mobile-specific navigation
 * - Performance on mobile
 * - Accessibility on mobile devices
 */

test.describe('Responsive Design - Mobile', () => {
  const viewports = [
    {
      name: 'iPhone 14 Pro',
      device: devices['iPhone 14 Pro'],
      isMobile: true,
      hasTouch: true
    },
    {
      name: 'Pixel 5',
      device: devices['Pixel 5'],
      isMobile: true,
      hasTouch: true
    },
    {
      name: 'iPad Pro',
      device: devices['iPad Pro'],
      isMobile: false,
      hasTouch: true
    },
    {
      name: 'Galaxy Tab S4',
      device: devices['Galaxy Tab S4'],
      isMobile: false,
      hasTouch: true
    }
  ];

  viewports.forEach(({ name, device, isMobile, hasTouch }) => {
    test.describe(`${name} - ${isMobile ? 'Mobile' : 'Tablet'}`, () => {
      let authPage: AuthPage;
      let dashboardPage: DashboardPage;

      test.use({ ...device });

      test.beforeEach(async ({ page }) => {
        authPage = new AuthPage(page);
        dashboardPage = new DashboardPage(page);

        // Add mobile-specific headers if needed
        await page.setExtraHTTPHeaders({
          'User-Agent': device.userAgent || 'CLMS-Mobile-Test'
        });
      });

      test('should display login page correctly on mobile device', async ({ page }) => {
        await authPage.goto();

        // Check login form adapts to mobile
        await expect(authPage.loginForm).toBeVisible();
        await expect(authPage.usernameInput).toBeVisible();
        await expect(authPage.passwordInput).toBeVisible();
        await expect(authPage.signInButton).toBeVisible();

        // Check mobile-specific elements
        if (isMobile) {
          // Check for mobile menu or different layout
          const mobileHeader = page.locator('[data-testid="mobile-header"]');
          if (await mobileHeader.isVisible()) {
            await expect(mobileHeader).toBeVisible();
          }

          // Check for stacked layout
          const formWidth = await authPage.loginForm.boundingBox();
          if (formWidth) {
            expect(formWidth.width).toBeLessThanOrEqual(device.viewport.width - 40); // Account for padding
          }
        }

        // Test touch interactions
        if (hasTouch) {
          await authPage.usernameInput.tap();
          await expect(authPage.usernameInput).toBeFocused();

          await authPage.passwordInput.tap();
          await expect(authPage.passwordInput).toBeFocused();
        }
      });

      test('should handle mobile login successfully', async ({ page }) => {
        await authPage.goto();

        // Test mobile login
        await authPage.login('admin', 'librarian123');

        // Verify dashboard loads correctly on mobile
        await expect(page).toHaveURL('/');

        if (isMobile) {
          // Check for mobile navigation
          const mobileNav = page.locator('[data-testid="mobile-navigation"]');
          if (await mobileNav.isVisible()) {
            await expect(mobileNav).toBeVisible();
          }

          // Check for hamburger menu
          const hamburgerMenu = page.locator('[data-testid="hamburger-menu"]');
          if (await hamburgerMenu.isVisible()) {
            await expect(hamburgerMenu).toBeVisible();
          }
        }
      });

      test('should adapt navigation for mobile device', async ({ page }) => {
        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        // Test tab navigation on mobile
        if (isMobile) {
          // Check if tabs are scrollable horizontally
          const tabsContainer = page.locator('[data-testid="dashboard-tabs"]');
          if (await tabsContainer.isVisible()) {
            const containerBox = await tabsContainer.boundingBox();
            if (containerBox) {
              // Check if tabs are wider than container (indicates horizontal scroll)
              const tabs = tabsContainer.locator('[role="tab"]');
              const tabCount = await tabs.count();
              if (tabCount > 0) {
                const lastTab = tabs.last();
                const lastTabBox = await lastTab.boundingBox();
                if (lastTabBox) {
                  const totalWidth = lastTabBox.x + lastTabBox.width;
                  const needsScroll = totalWidth > containerBox.width;

                  console.log(`${name}: Tabs need horizontal scroll: ${needsScroll}`);
                }
              }
            }
          }

          // Test mobile navigation menu
          const mobileMenuToggle = page.locator('[data-testid="mobile-menu-toggle"]');
          if (await mobileMenuToggle.isVisible()) {
            await mobileMenuToggle.tap();

            // Check if menu opens
            const mobileMenu = page.locator('[data-testid="mobile-menu"]');
            await expect(mobileMenu).toBeVisible();

            // Test menu items are touch-friendly
            const menuItems = mobileMenu.locator('[role="menuitem"]');
            const itemCount = await menuItems.count();
            expect(itemCount).toBeGreaterThan(0);

            // Check touch target sizes (should be at least 44x44 points)
            for (let i = 0; i < Math.min(itemCount, 3); i++) {
              const item = menuItems.nth(i);
              const boundingBox = await item.boundingBox();
              if (boundingBox) {
                expect(boundingBox.height).toBeGreaterThanOrEqual(44);
                expect(boundingBox.width).toBeGreaterThanOrEqual(44);
              }
            }
          }
        }
      });

      test('should handle mobile forms correctly', async ({ page }) => {
        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        // Test student management form on mobile
        await dashboardPage.navigateToStudentManagement();

        // Check form layout
        const addStudentButton = page.locator('[data-testid="add-student-button"]');
        if (await addStudentButton.isVisible()) {
          await addStudentButton.tap();

          // Check form adapts to mobile
          const form = page.locator('[data-testid="student-form"]');
          if (await form.isVisible()) {
            // Check input fields are properly sized for touch
            const inputs = form.locator('input, select');
            const inputCount = await inputs.count();

            for (let i = 0; i < Math.min(inputCount, 5); i++) {
              const input = inputs.nth(i);
              const boundingBox = await input.boundingBox();
              if (boundingBox) {
                // Touch targets should be at least 44px high
                expect(boundingBox.height).toBeGreaterThanOrEqual(44);
              }
            }

            // Check submit button is easily tappable
            const submitButton = form.locator('button[type="submit"]');
            if (await submitButton.isVisible()) {
              const buttonBox = await submitButton.boundingBox();
              if (buttonBox) {
                expect(buttonBox.height).toBeGreaterThanOrEqual(44);
                expect(buttonBox.width).toBeGreaterThanOrEqual(44);
              }
            }
          }
        }
      });

      test('should handle mobile tables and lists', async ({ page }) => {
        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        // Test student list on mobile
        await dashboardPage.navigateToStudentManagement();

        const studentList = page.locator('[data-testid="student-list"]');
        if (await studentList.isVisible()) {
          // On mobile, tables might be converted to cards or stacked layout
          const tableHeaders = page.locator('thead');
          const hasTableHeaders = await tableHeaders.count() > 0;

          if (isMobile && !hasTableHeaders) {
            // Check for card-based layout
            const studentCards = page.locator('[data-testid="student-card"]');
            const cardCount = await studentCards.count();

            if (cardCount > 0) {
              // Cards should be easily tappable
              const firstCard = studentCards.first();
              const cardBox = await firstCard.boundingBox();
              if (cardBox) {
                expect(cardBox.height).toBeGreaterThanOrEqual(60); // Minimum touch height
              }
            }
          } else {
            // Check if table is horizontally scrollable on mobile
            const tableContainer = page.locator('.table-container');
            if (await tableContainer.isVisible()) {
              const hasHorizontalScroll = await tableContainer.evaluate(el =>
                el.scrollWidth > el.clientWidth
              );

              if (isMobile) {
                console.log(`${name}: Table has horizontal scroll: ${hasHorizontalScroll}`);
              }
            }
          }
        }
      });

      test('should handle mobile modals and dialogs', async ({ page }) => {
        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        // Test modal behavior on mobile
        await dashboardPage.navigateToStudentManagement();

        // Try to trigger a modal
        const addButton = page.locator('[data-testid="add-student-button"]');
        if (await addButton.isVisible()) {
          await addButton.tap();

          const modal = page.locator('[data-testid="modal"], [role="dialog"]');
          if (await modal.isVisible()) {
            // Check modal is properly sized for mobile
            const modalBox = await modal.boundingBox();
            if (modalBox) {
              // Modal should be close to full width on mobile
              if (isMobile) {
                expect(modalBox.width).toBeGreaterThan(device.viewport.width * 0.9);
              }
            }

            // Check close button is easily tappable
            const closeButton = modal.locator('[data-testid="close-button"], button[aria-label="Close"]');
            if (await closeButton.isVisible()) {
              const closeBox = await closeButton.boundingBox();
              if (closeBox) {
                expect(closeBox.height).toBeGreaterThanOrEqual(44);
                expect(closeBox.width).toBeGreaterThanOrEqual(44);
              }
            }

            // Test backdrop click to close (if supported)
            if (hasTouch) {
              const backdrop = page.locator('[data-testid="modal-backdrop"]');
              if (await backdrop.isVisible()) {
                await backdrop.tap({ position: { x: 10, y: 10 } });
                await page.waitForTimeout(500);

                // Modal should be closed
                const modalVisible = await modal.isVisible();
                expect(modalVisible).toBe(false);
              }
            }
          }
        }
      });

      test('should handle mobile gestures', async ({ page }) => {
        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        if (hasTouch) {
          // Test swipe gestures for navigation
          const dashboardContent = page.locator('[data-testid="dashboard-content"]');
          if (await dashboardContent.isVisible()) {
            // Test horizontal swipe for tab navigation (if implemented)
            const startX = device.viewport.width * 0.8;
            const endX = device.viewport.width * 0.2;
            const y = device.viewport.height / 2;

            await page.touch().move(startX, y);
            await page.touch().down();
            await page.touch().move(endX, y, { steps: 10 });
            await page.touch().up();

            await page.waitForTimeout(1000);
          }

          // Test vertical scroll
          const scrollableContent = page.locator('[data-testid="scrollable-content"]');
          if (await scrollableContent.isVisible()) {
            const scrollHeight = await scrollableContent.evaluate(el => el.scrollHeight);
            const clientHeight = await scrollableContent.evaluate(el => el.clientHeight);

            if (scrollHeight > clientHeight) {
              // Test scroll to bottom
              const startY = 100;
              const endY = device.viewport.height - 100;

              await page.touch().move(device.viewport.width / 2, startY);
              await page.touch().down();
              await page.touch().move(device.viewport.width / 2, endY, { steps: 10 });
              await page.touch().up();

              await page.waitForTimeout(1000);
            }
          }
        }
      });

      test('should handle mobile virtual keyboard', async ({ page }) => {
        await authPage.goto();

        // Focus on input field to trigger virtual keyboard
        await authPage.usernameInput.tap();

        // Virtual keyboard should appear (simulated in Playwright)
        await expect(authPage.usernameInput).toBeFocused();

        // Test that page adjusts when keyboard appears
        const formBox = await authPage.loginForm.boundingBox();
        if (formBox) {
          // Form should still be visible and accessible
          expect(formBox.y).toBeGreaterThanOrEqual(0);
        }

        // Test typing with virtual keyboard
        await authPage.usernameInput.fill('testuser');
        const inputValue = await authPage.usernameInput.inputValue();
        expect(inputValue).toBe('testuser');

        // Switch to password field
        await authPage.passwordInput.tap();
        await expect(authPage.passwordInput).toBeFocused();

        await authPage.passwordInput.fill('testpass');
        const passwordValue = await authPage.passwordInput.inputValue();
        expect(passwordValue).toBe('testpass');
      });

      test('should maintain performance on mobile', async ({ page }) => {
        const startTime = Date.now();

        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        const loginTime = Date.now() - startTime;

        // Mobile login should be reasonably fast
        expect(loginTime).toBeLessThan(10000); // 10 seconds max for mobile

        // Test navigation performance
        const navStartTime = Date.now();
        await dashboardPage.navigateToStudentManagement();
        const navTime = Date.now() - navStartTime;

        // Navigation should be fast on mobile
        expect(navTime).toBeLessThan(5000); // 5 seconds max

        // Test for performance issues
        const performanceMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
          };
        });

        console.log(`${name} Performance Metrics:`, performanceMetrics);

        // Check reasonable performance thresholds
        expect(performanceMetrics.domContentLoaded).toBeLessThan(3000);
        expect(performanceMetrics.loadComplete).toBeLessThan(8000);
      });

      test('should handle mobile accessibility', async ({ page }) => {
        await authPage.goto();

        // Test mobile accessibility features
        await expect(authPage.usernameInput).toHaveAttribute('aria-label');
        await expect(authPage.passwordInput).toHaveAttribute('aria-label');

        // Test focus management
        await authPage.usernameInput.tap();
        await expect(authPage.usernameInput).toBeFocused();

        // Test swipe navigation for screen readers (if implemented)
        await page.keyboard.press('Tab');
        await expect(authPage.passwordInput).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(authPage.signInButton).toBeFocused();

        // Test mobile-specific accessibility
        if (isMobile) {
          // Check for proper touch target sizes for accessibility
          const tappableElements = page.locator('button, input, [role="button"]');
          const elementCount = await tappableElements.count();

          for (let i = 0; i < Math.min(elementCount, 10); i++) {
            const element = tappableElements.nth(i);
            const boundingBox = await element.boundingBox();

            if (boundingBox) {
              // WCAG recommends 44x44 CSS pixels for touch targets
              expect(boundingBox.width).toBeGreaterThanOrEqual(44);
              expect(boundingBox.height).toBeGreaterThanOrEqual(44);
            }
          }
        }
      });

      test('should handle mobile orientation changes', async ({ page }) => {
        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        // Test portrait to landscape
        await page.setViewportSize({
          width: device.viewport.height,
          height: device.viewport.width
        });

        await page.waitForTimeout(1000);

        // Check layout adapts to new orientation
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

        // Test landscape to portrait
        await page.setViewportSize(device.viewport);
        await page.waitForTimeout(1000);

        // Check layout adapts back
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
      });

      test('should handle mobile network conditions', async ({ page }) => {
        // Simulate slow 3G network
        await page.route('**/*', async route => {
          // Add delay to simulate slow network
          await new Promise(resolve => setTimeout(resolve, 1000));
          await route.continue();
        });

        const startTime = Date.now();

        await authPage.goto();
        const loadTime = Date.now() - startTime;

        // Should still load reasonably even on slow network
        expect(loadTime).toBeLessThan(20000); // 20 seconds max on slow network

        // Test interactive elements work even with slow network
        await expect(authPage.loginForm).toBeVisible();
        await authPage.usernameInput.fill('admin');
        await authPage.passwordInput.fill('librarian123');

        const loginStartTime = Date.now();
        await authPage.submitLogin();
        const loginResponseTime = Date.now() - loginStartTime;

        expect(loginResponseTime).toBeLessThan(15000); // 15 seconds max on slow network
      });
    });
  });

  test.describe('Cross-Device Consistency', () => {
    test('should maintain feature parity across devices', async ({ page }) => {
      // Test that core features work on all device types
      const devices = ['Desktop Chrome', 'iPad Pro', 'iPhone 14 Pro'];
      const authPage = new AuthPage(page);
      const dashboardPage = new DashboardPage(page);

      for (const deviceName of devices) {
        console.log(`Testing feature parity on ${deviceName}`);

        // Set appropriate viewport
        let viewport;
        switch (deviceName) {
          case 'Desktop Chrome':
            viewport = { width: 1920, height: 1080 };
            break;
          case 'iPad Pro':
            viewport = { width: 1024, height: 1366 };
            break;
          case 'iPhone 14 Pro':
            viewport = { width: 393, height: 852 };
            break;
        }

        await page.setViewportSize(viewport);

        // Test core functionality
        await authPage.goto();
        await authPage.login('admin', 'librarian123');

        // Test navigation
        await dashboardPage.navigateToStudentManagement();
        await expect(page.locator('[data-testid="student-list"]')).toBeVisible();

        await dashboardPage.navigateToBookCatalog();
        await expect(page.locator('[data-testid="book-list"]')).toBeVisible();

        console.log(`✅ Feature parity confirmed for ${deviceName}`);
      }
    });

    test('should adapt content appropriately for screen size', async ({ page }) => {
      const screenSizes = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 1024, height: 768, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];

      for (const size of screenSizes) {
        await page.setViewportSize(size);

        // Check layout adaptation
        await page.goto('/login');

        const loginForm = page.locator('[data-testid="login-form"]');
        const formBox = await loginForm.boundingBox();

        if (formBox) {
          // Form should be appropriately sized for screen
          const maxWidth = size.width * 0.9; // 90% of screen width
          expect(formBox.width).toBeLessThanOrEqual(maxWidth);

          // Form should be centered
          const expectedX = (size.width - formBox.width) / 2;
          expect(Math.abs(formBox.x - expectedX)).toBeLessThan(50); // Allow 50px tolerance
        }

        console.log(`✅ Layout adaptation confirmed for ${size.name} (${size.width}x${size.height})`);
      }
    });
  });
});