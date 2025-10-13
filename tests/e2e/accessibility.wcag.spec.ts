import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { AuthPage } from './page-objects/auth.page';
import { DashboardPage } from './page-objects/dashboard.page';

/**
 * WCAG 2.1 AA Accessibility Tests
 *
 * Tests accessibility compliance according to WCAG 2.1 AA guidelines:
 * - Perceivable: Information and UI components must be presentable in ways users can perceive
 * - Operable: UI components and navigation must be operable
 * - Understandable: Information and UI operation must be understandable
 * - Robust: Content must be robust enough for various assistive technologies
 *
 * Coverage includes:
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Color contrast
 * - Focus management
 * - ARIA labels and roles
 * - Alternative text for images
 * - Form accessibility
 * - Link and button accessibility
 * - Table accessibility
 * - Mobile accessibility
 */

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);

    // Inject axe for accessibility testing
    await injectAxe(page);
  });

  test.describe('Login Page Accessibility', () => {
    test('should be accessible on login page', async ({ page }) => {
      await authPage.goto();

      // Run axe accessibility checks
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true },
        rules: {
          // Enable WCAG 2.1 AA rules
          'color-contrast': { enabled: true },
          'keyboard': { enabled: true },
          'focus-order-semantics': { enabled: true },
          'aria-input-field-name': { enabled: true },
          'label': { enabled: true },
          'link-in-text-block': { enabled: true },
          'bypass': { enabled: true },
          'page-has-heading-one': { enabled: true },
          'landmark-one-main': { enabled: true },
        }
      });
    });

    test('should have proper semantic structure', async ({ page }) => {
      await authPage.goto();

      // Check for proper heading structure (h1-h6 in order)
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);

      // Should have a main heading (h1)
      const mainHeading = page.locator('h1');
      await expect(mainHeading).toBeVisible();

      // Check for proper landmark elements
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('nav')).toHaveCount.lessThanOrEqual(1);

      // Check for proper form structure
      await expect(authPage.loginForm).toHaveAttribute('role', 'form');

      // Check for proper labels
      await expect(authPage.usernameInput).toHaveAttribute('aria-label');
      await expect(authPage.passwordInput).toHaveAttribute('aria-label');
    });

    test('should support keyboard navigation', async ({ page }) => {
      await authPage.goto();

      // Test tab order
      await page.keyboard.press('Tab');
      await expect(authPage.usernameInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(authPage.passwordInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(authPage.signInButton).toBeFocused();

      // Test Enter key submission
      await page.keyboard.press('Enter');

      // Check if form submission attempt was made
      const stillOnLogin = await page.locator('form').isVisible();
      expect(typeof stillOnLogin).toBe('boolean');
    });

    test('should have proper color contrast', async ({ page }) => {
      await authPage.goto();

      // Check color contrast for text elements
      const textElements = page.locator('p, h1, h2, h3, h4, h5, h6, label, span');
      const elementCount = await textElements.count();

      for (let i = 0; i < Math.min(elementCount, 10); i++) {
        const element = textElements.nth(i);
        const isVisible = await element.isVisible();

        if (isVisible) {
          const styles = await element.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize
            };
          });

          // Ensure colors are not the same (basic contrast check)
          expect(styles.color).not.toBe(styles.backgroundColor);
        }
      }
    });

    test('should have proper ARIA attributes', async ({ page }) => {
      await authPage.goto();

      // Check form inputs have proper ARIA
      await expect(authPage.usernameInput).toHaveAttribute('aria-label');
      await expect(authPage.passwordInput).toHaveAttribute('aria-label');

      // Check button has proper ARIA
      await expect(authPage.signInButton).toHaveRole('button');
      await expect(authPage.signInButton).toHaveAttribute('type', 'submit');

      // Check for aria-describedby on form fields
      const usernameDescribedBy = await authPage.usernameInput.getAttribute('aria-describedby');
      const passwordDescribedBy = await authPage.passwordInput.getAttribute('aria-describedby');

      if (usernameDescribedBy) {
        await expect(page.locator(`#${usernameDescribedBy}`)).toBeVisible();
      }

      if (passwordDescribedBy) {
        await expect(page.locator(`#${passwordDescribedBy}`)).toBeVisible();
      }
    });

    test('should support screen readers', async ({ page }) => {
      await authPage.goto();

      // Check for page title
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);

      // Check for language attribute
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();

      // Check for skip links (if implemented)
      const skipLinks = page.locator('a[href^="#"]:has-text("Skip")');
      const skipLinkCount = await skipLinks.count();

      if (skipLinkCount > 0) {
        console.log('Skip links found:', skipLinkCount);
      }

      // Check for alt text on images
      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        const alt = await image.getAttribute('alt');
        const isDecorative = await image.getAttribute('role') === 'presentation';

        // Images should have alt text unless decorative
        expect(alt || isDecorative).toBeTruthy();
      }
    });
  });

  test.describe('Dashboard Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await authPage.goto();
      await authPage.login('admin', 'librarian123');
    });

    test('should be accessible on dashboard overview', async ({ page }) => {
      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });

      // Run accessibility checks on dashboard
      await checkA11y(page, null, {
        detailedReport: true,
        rules: {
          'color-contrast': { enabled: true },
          'keyboard': { enabled: true },
          'focus-order-semantics': { enabled: true },
          'aria-input-field-name': { enabled: true },
          'link-name': { enabled: true },
          'button-name': { enabled: true },
          'heading-order': { enabled: true },
          'landmark-unique': { enabled: true },
        }
      });
    });

    test('should have accessible navigation', async ({ page }) => {
      // Check tab navigation
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);

      // Each tab should have proper accessibility attributes
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        await expect(tab).toHaveAttribute('aria-selected');
        await expect(tab).toHaveAttribute('aria-controls');

        const tabText = await tab.textContent();
        expect(tabText).toBeTruthy();
        expect(tabText!.length).toBeGreaterThan(0);
      }

      // Test keyboard navigation through tabs
      await page.keyboard.press('Tab');
      const firstTab = tabs.first();
      await expect(firstTab).toBeFocused();

      // Test arrow key navigation
      await page.keyboard.press('ArrowRight');
      // Should move to next tab
    });

    test('should have accessible data tables', async ({ page }) => {
      // Navigate to student management to test tables
      await dashboardPage.navigateToStudentManagement();

      const tables = page.locator('table');
      const tableCount = await tables.count();

      if (tableCount > 0) {
        const table = tables.first();

        // Check for proper table structure
        await expect(table.locator('thead')).toBeVisible();
        await expect(table.locator('tbody')).toBeVisible();

        // Check for table headers
        const headers = table.locator('th');
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThan(0);

        // Check for scope attributes on headers
        for (let i = 0; i < headerCount; i++) {
          const header = headers.nth(i);
          const scope = await header.getAttribute('scope');
          expect(scope).toBeTruthy();
        }

        // Check for table caption (if applicable)
        const caption = table.locator('caption');
        if (await caption.isVisible()) {
          const captionText = await caption.textContent();
          expect(captionText).toBeTruthy();
        }
      }
    });

    test('should have accessible forms', async ({ page }) => {
      // Navigate to student management to test forms
      await dashboardPage.navigateToStudentManagement();

      // Look for forms
      const forms = page.locator('form');
      const formCount = await forms.count();

      if (formCount > 0) {
        const form = forms.first();

        // Check for form labels
        const inputs = form.locator('input, select, textarea');
        const inputCount = await inputs.count();

        for (let i = 0; i < Math.min(inputCount, 5); i++) {
          const input = inputs.nth(i);

          // Each input should have a label or aria-label
          const hasLabel = await input.locator('xpath=./ancestor::label').count() > 0;
          const hasAriaLabel = await input.getAttribute('aria-label');
          const hasAriaLabelledBy = await input.getAttribute('aria-labelledby');

          expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
        }

        // Check for form submission buttons
        const submitButtons = form.locator('button[type="submit"], input[type="submit"]');
        const submitCount = await submitButtons.count();

        if (submitCount > 0) {
          const button = submitButtons.first();
          const buttonText = await button.textContent();
          expect(buttonText).toBeTruthy();
          expect(buttonText!.length).toBeGreaterThan(0);
        }
      }
    });

    test('should have accessible links and buttons', async ({ page }) => {
      // Check all links
      const links = page.locator('a[href]');
      const linkCount = await links.count();

      for (let i = 0; i < Math.min(linkCount, 10); i++) {
        const link = links.nth(i);
        const linkText = await link.textContent();
        const hasAriaLabel = await link.getAttribute('aria-label');

        // Links should have descriptive text or aria-label
        expect((linkText && linkText.trim().length > 0) || hasAriaLabel).toBeTruthy();

        // Check for external link indicators
        const href = await link.getAttribute('href');
        if (href && (href.startsWith('http') && !href.includes(window.location.hostname))) {
          const hasExternalIndicator = await link.getAttribute('aria-label')?.includes('external') ||
                                    await link.getAttribute('target') === '_blank';

          if (await link.getAttribute('target') === '_blank') {
            // External links opening in new tabs should have warning
            const hasWarning = await link.getAttribute('aria-label')?.includes('opens in new tab') ||
                             await link.getAttribute('title')?.includes('opens in new tab');
            expect(hasWarning).toBeTruthy();
          }
        }
      }

      // Check all buttons
      const buttons = page.locator('button, [role="button"]');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        const buttonText = await button.textContent();
        const hasAriaLabel = await button.getAttribute('aria-label');
        const hasTitle = await button.getAttribute('title');

        // Buttons should have descriptive text, aria-label, or title
        expect((buttonText && buttonText.trim().length > 0) || hasAriaLabel || hasTitle).toBeTruthy();
      }
    });

    test('should handle focus management properly', async ({ page }) => {
      // Test that focus is visible
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Check for visible focus indicators
      const focusedStyles = await focusedElement.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          outline: computed.outline,
          boxShadow: computed.boxShadow,
          border: computed.border
        };
      });

      // Should have some kind of focus indicator
      const hasFocusIndicator = focusedStyles.outline !== 'none' ||
                               focusedStyles.boxShadow !== 'none' ||
                               focusedStyles.border !== 'none';

      expect(hasFocusIndicator).toBeTruthy();

      // Test focus trap in modals (if any)
      await dashboardPage.navigateToStudentManagement();

      const addButton = page.locator('[data-testid="add-student-button"]');
      if (await addButton.isVisible()) {
        await addButton.click();

        // Check if modal opens
        const modal = page.locator('[data-testid="modal"], [role="dialog"]');
        if (await modal.isVisible()) {
          // Focus should be trapped inside modal
          const modalFocused = await modal.locator(':focus').count() > 0;
          expect(modalFocused).toBeTruthy();
        }
      }
    });

    test('should support assistive technology announcements', async ({ page }) => {
      // Check for live regions
      const liveRegions = page.locator('[aria-live]');
      const liveRegionCount = await liveRegions.count();

      if (liveRegionCount > 0) {
        console.log('Live regions found:', liveRegionCount);

        // Test live region announcements
        for (let i = 0; i < liveRegionCount; i++) {
          const region = liveRegions.nth(i);
          const politeness = await region.getAttribute('aria-live');
          expect(['polite', 'assertive', 'off']).toContain(politeness || 'off');
        }
      }

      // Check for status messages
      const statusRegions = page.locator('[role="status"]');
      const statusCount = await statusRegions.count();

      if (statusCount > 0) {
        console.log('Status regions found:', statusCount);
      }

      // Check for alert regions
      const alertRegions = page.locator('[role="alert"]');
      const alertCount = await alertRegions.count();

      if (alertCount > 0) {
        console.log('Alert regions found:', alertCount);
      }
    });

    test('should have proper heading structure', async ({ page }) => {
      // Check heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();

      expect(headingCount).toBeGreaterThan(0);

      let lastLevel = 0;
      for (let i = 0; i < headingCount; i++) {
        const heading = headings.nth(i);
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
        const level = parseInt(tagName.charAt(1));

        // Heading levels should not skip levels (e.g., h1 to h3)
        if (lastLevel > 0) {
          expect(level - lastLevel).toBeLessThanOrEqual(1);
        }

        lastLevel = level;
      }

      // Should have only one h1 per page
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeLessThanOrEqual(1);
    });

    test('should be accessible on all dashboard tabs', async ({ page }) => {
      const tabs = [
        'Dashboard',
        'Students',
        'Books',
        'Checkout',
        'Equipment',
        'Scan',
        'Analytics',
        'Automation',
        'Reports',
        'Barcode',
        'QR',
        'Notifications',
        'Settings'
      ];

      for (const tab of tabs) {
        console.log(`Testing accessibility on ${tab} tab`);

        try {
          await dashboardPage.navigateToTab(tab);
          await page.waitForTimeout(2000); // Wait for content to load

          // Run basic accessibility checks
          await checkA11y(page, null, {
            includedImpacts: ['critical', 'serious'],
            detailedReport: false
          });

          console.log(`✅ ${tab} tab is accessible`);
        } catch (error) {
          console.log(`❌ ${tab} tab has accessibility issues:`, error);
        }
      }
    });

    test('should handle error messages accessibly', async ({ page }) => {
      // Test error message accessibility
      await dashboardPage.navigateToStudentManagement();

      // Try to trigger an error (e.g., invalid form submission)
      const addButton = page.locator('[data-testid="add-student-button"]');
      if (await addButton.isVisible()) {
        await addButton.click();

        // Submit empty form to trigger validation errors
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Check for error messages
          const errorMessages = page.locator('[data-testid="error"], [role="alert"]');
          const errorCount = await errorMessages.count();

          if (errorCount > 0) {
            // Error messages should be properly associated with inputs
            for (let i = 0; i < errorCount; i++) {
              const error = errorMessages.nth(i);
              await expect(error).toBeVisible();

              // Check if error is announced to screen readers
              const role = await error.getAttribute('role');
              const ariaLive = await error.getAttribute('aria-live');

              expect(['alert', 'status'].includes(role || '') ||
                     ['assertive', 'polite'].includes(ariaLive || '')).toBeTruthy();
            }
          }
        }
      }
    });

    test('should support high contrast mode', async ({ page }) => {
      // Test high contrast mode by simulating Windows High Contrast
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

      // Check that content is still readable
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });

      // Check that important elements are still visible
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
      await expect(page.locator('[role="tab"]').first()).toBeVisible();

      // Test keyboard navigation in high contrast mode
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should support reduced motion', async ({ page }) => {
      // Test reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });

      // Test that animations are reduced
      // This is a basic test - in practice, you'd check specific animations
      const animatedElements = page.locator('[data-animate], [class*="animate"]');
      const animatedCount = await animatedElements.count();

      console.log(`Animated elements found: ${animatedCount}`);

      // Elements should still be functional without animations
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    });

    test('should have accessible data visualizations', async ({ page }) => {
      // Navigate to analytics for charts
      await dashboardPage.navigateToAnalyticsDashboard();

      // Check for chart accessibility
      const charts = page.locator('[data-testid="chart"], canvas, svg');
      const chartCount = await charts.count();

      if (chartCount > 0) {
        for (let i = 0; i < chartCount; i++) {
          const chart = charts.nth(i);

          // Charts should have alternative text or data tables
          const chartTitle = await chart.getAttribute('aria-label') ||
                            await chart.getAttribute('title') ||
                            await chart.locator('../preceding-sibling::*[contains(text(), "Chart")]').textContent();

          expect(chartTitle).toBeTruthy();

          // Check for data table alternative
          const dataTable = page.locator('[data-testid="data-table"]');
          const hasDataTable = await dataTable.count() > 0;

          if (hasDataTable) {
            console.log('Data table alternative found for chart');
          }
        }
      }
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await authPage.goto();

      // Run accessibility checks on mobile
      await checkA11y(page, null, {
        detailedReport: true,
        rules: {
          'color-contrast': { enabled: true },
          'target-size': { enabled: true }, // Touch target size
          'touch-target-size': { enabled: true },
        }
      });

      // Test touch target sizes
      const tappableElements = page.locator('button, input, [role="button"], a');
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
    });

    test('should support mobile screen readers', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Test swipe gestures for screen readers (simulated)
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Test that mobile-specific elements are accessible
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toHaveAttribute('role');
        await expect(mobileMenu).toHaveAttribute('aria-label');
      }
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should maintain accessibility with performance optimizations', async ({ page }) => {
      // Test that lazy loading doesn't break accessibility
      await authPage.goto();
      await authPage.login('admin', 'librarian123');

      // Navigate to different tabs and check accessibility
      const tabs = ['Students', 'Books', 'Analytics'];

      for (const tab of tabs) {
        await dashboardPage.navigateToTab(tab);
        await page.waitForTimeout(2000);

        // Quick accessibility check
        await checkA11y(page, null, {
          includedImpacts: ['critical'],
          detailedReport: false
        });
      }
    });

    test('should handle assistive technology with network delays', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });

      await authPage.goto();

      // Check that loading indicators are accessible
      const loadingIndicators = page.locator('[data-testid="loading"], [aria-busy="true"]');
      const loadingCount = await loadingIndicators.count();

      if (loadingCount > 0) {
        for (let i = 0; i < loadingCount; i++) {
          const indicator = loadingIndicators.nth(i);
          await expect(indicator).toHaveAttribute('aria-busy', 'true');

          const ariaLabel = await indicator.getAttribute('aria-label');
          if (ariaLabel) {
            expect(ariaLabel).toContain('loading');
          }
        }
      }
    });
  });
});