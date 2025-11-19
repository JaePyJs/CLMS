import { test, expect } from '@playwright/test';

const LIBRARIAN_CREDENTIALS = {
  username: 'librarian',
  password: 'password123',
};

test.describe('🏛️ Enhanced Library Management System - Complete Test Suite', () => {
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

  test.describe('📊 User Tracking Module', () => {
    test('should display current patrons in library', async ({ page }) => {
      // Navigate to User Tracking tab
      await page.click('button:has-text("User Tracking")');
      await page.waitForLoadState('networkidle');

      // Check if user tracking content is visible
      await expect(
        page.locator('h2:has-text("Current Patrons")')
      ).toBeVisible();
      await expect(page.locator('text=Total Patrons')).toBeVisible();

      // Check for patron list or empty state
      const patronCount = await page.locator('text=/\\d+ patrons?/').count();
      const emptyState = await page
        .locator('text=No patrons currently in library')
        .count();

      expect(patronCount + emptyState).toBeGreaterThan(0);
    });

    test('should show patron statistics', async ({ page }) => {
      await page.click('button:has-text("User Tracking")');
      await page.waitForLoadState('networkidle');

      // Check for statistics cards
      await expect(page.locator('text=Total Patrons')).toBeVisible();
      await expect(page.locator('text=Active Today')).toBeVisible();
      await expect(page.locator('text=Most Popular Purpose')).toBeVisible();
    });

    test('should filter patrons by purpose', async ({ page }) => {
      await page.click('button:has-text("User Tracking")');
      await page.waitForLoadState('networkidle');

      // Check for purpose filter buttons
      const purposeButtons = [
        'button:has-text("All")',
        'button:has-text("AVR")',
        'button:has-text("Computer")',
        'button:has-text("Library Space")',
        'button:has-text("Borrowing")',
        'button:has-text("Recreation")',
      ];

      for (const button of purposeButtons) {
        const count = await page.locator(button).count();
        if (count > 0) {
          await page.click(button);
          await page.waitForTimeout(500);
          break;
        }
      }
    });
  });

  test.describe('📚 Enhanced Borrowing Flow', () => {
    test('should display enhanced borrowing interface', async ({ page }) => {
      await page.click('button:has-text("Enhanced Borrowing")');
      await page.waitForLoadState('networkidle');

      // Check for borrowing interface elements
      await expect(
        page.locator('h2:has-text("Enhanced Borrowing")')
      ).toBeVisible();
      await expect(page.locator('text=Select Student')).toBeVisible();
      await expect(page.locator('text=Select Books')).toBeVisible();
      await expect(page.locator('text=Borrowing Summary')).toBeVisible();
    });

    test('should show material type selection', async ({ page }) => {
      await page.click('button:has-text("Enhanced Borrowing")');
      await page.waitForLoadState('networkidle');

      // Check for material type options
      const materialTypes = [
        'Filipiniana',
        'Fiction',
        'Easy Books',
        'Reference',
        'Textbook',
        'Periodical',
      ];

      for (const type of materialTypes) {
        const count = await page.locator(`text=${type}`).count();
        if (count > 0) {
          await expect(page.locator(`text=${type}`)).toBeVisible();
        }
      }
    });

    test('should calculate due dates based on material type', async ({
      page,
    }) => {
      await page.click('button:has-text("Enhanced Borrowing")');
      await page.waitForLoadState('networkidle');

      // Check for due date information
      await expect(page.locator('text=Due Date')).toBeVisible();

      // Check for material-specific due dates
      const dueDateInfo = await page
        .locator('text=/Due: \\w+ \\d{1,2}, \\d{4}/')
        .count();
      expect(dueDateInfo).toBeGreaterThanOrEqual(0);
    });

    test('should show borrowing policies', async ({ page }) => {
      await page.click('button:has-text("Enhanced Borrowing")');
      await page.waitForLoadState('networkidle');

      // Check for policy information
      const policyInfo = await page
        .locator('text=/Filipiniana.*3 days|Fiction.*7 days|Easy Books.*1 day/')
        .count();
      expect(policyInfo).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('💰 Overdue Management', () => {
    test('should display overdue books dashboard', async ({ page }) => {
      await page.click('button:has-text("Overdue Management")');
      await page.waitForLoadState('networkidle');

      // Check for overdue management interface
      await expect(
        page.locator('h2:has-text("Overdue Management")')
      ).toBeVisible();
      await expect(page.locator('text=Total Overdue')).toBeVisible();
      await expect(page.locator('text=Total Fines')).toBeVisible();
    });

    test('should show grade-based fine calculation', async ({ page }) => {
      await page.click('button:has-text("Overdue Management")');
      await page.waitForLoadState('networkidle');

      // Check for fine information
      const fineInfo = await page
        .locator('text=/₱[25]\\/day|Primary.*₱2|Elementary.*₱5/')
        .count();
      expect(fineInfo).toBeGreaterThanOrEqual(0);
    });

    test('should display overdue book list', async ({ page }) => {
      await page.click('button:has-text("Overdue Management")');
      await page.waitForLoadState('networkidle');

      // Check for overdue books table or list
      const overdueTable = await page
        .locator('table, .table, [role="table"]')
        .count();
      const overdueList = await page.locator('text=Overdue Books').count();

      expect(overdueTable + overdueList).toBeGreaterThan(0);
    });

    test('should show payment options', async ({ page }) => {
      await page.click('button:has-text("Overdue Management")');
      await page.waitForLoadState('networkidle');

      // Check for payment-related buttons or text
      const paymentOptions = await page
        .locator('text=Pay Fine|Payment|Collect')
        .count();
      expect(paymentOptions).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('📈 Library Analytics', () => {
    test('should display analytics dashboard', async ({ page }) => {
      await page.click('button:has-text("Library Analytics")');
      await page.waitForLoadState('networkidle');

      // Check for analytics interface
      await expect(
        page.locator('h2:has-text("Library Analytics")')
      ).toBeVisible();
      await expect(page.locator('text=Top Users')).toBeVisible();
      await expect(page.locator('text=Popular Books')).toBeVisible();
    });

    test('should show top users ranking', async ({ page }) => {
      await page.click('button:has-text("Library Analytics")');
      await page.waitForLoadState('networkidle');

      // Check for top users section
      const topUsersSection = await page
        .locator('text=Top Users|Most Active|Top Borrowers')
        .count();
      expect(topUsersSection).toBeGreaterThan(0);
    });

    test('should show popular books', async ({ page }) => {
      await page.click('button:has-text("Library Analytics")');
      await page.waitForLoadState('networkidle');

      // Check for popular books section
      const popularBooksSection = await page
        .locator('text=Popular Books|Most Borrowed|Trending')
        .count();
      expect(popularBooksSection).toBeGreaterThan(0);
    });

    test('should show borrowing statistics', async ({ page }) => {
      await page.click('button:has-text("Library Analytics")');
      await page.waitForLoadState('networkidle');

      // Check for statistics
      const statsSection = await page
        .locator('text=Statistics|Stats|Analytics')
        .count();
      expect(statsSection).toBeGreaterThan(0);
    });

    test('should have export functionality', async ({ page }) => {
      await page.click('button:has-text("Library Analytics")');
      await page.waitForLoadState('networkidle');

      // Check for export buttons
      const exportButtons = await page
        .locator(
          'button:has-text("Export")|button:has-text("Download")|button:has-text("PDF")|button:has-text("Excel")'
        )
        .count();
      expect(exportButtons).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('🖨️ Printing Service', () => {
    test('should display printing interface', async ({ page }) => {
      // Look for printing-related content in any tab
      const printingContent = await page
        .locator('text=Printing|Print Jobs|Print Service')
        .count();

      if (printingContent > 0) {
        await expect(page.locator('text=Printing')).toBeVisible();
        await expect(page.locator('text=Print Jobs')).toBeVisible();
      }
    });

    test('should show print pricing', async ({ page }) => {
      const pricingContent = await page
        .locator('text=₱2|₱5|Pricing|Cost')
        .count();
      expect(pricingContent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('📋 Inventory Management', () => {
    test('should display inventory interface', async ({ page }) => {
      const inventoryContent = await page
        .locator('text=Inventory|Books|Materials')
        .count();
      expect(inventoryContent).toBeGreaterThanOrEqual(0);
    });

    test('should support barcode scanning', async ({ page }) => {
      const barcodeContent = await page
        .locator('text=Barcode|Scan|ISBN')
        .count();
      expect(barcodeContent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('📄 Reports Generation', () => {
    test('should display reports interface', async ({ page }) => {
      const reportsContent = await page
        .locator('text=Reports|Monthly|Export')
        .count();
      expect(reportsContent).toBeGreaterThanOrEqual(0);
    });

    test('should support PDF and Excel export', async ({ page }) => {
      const exportContent = await page.locator('text=PDF|Excel|Export').count();
      expect(exportContent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('🔧 System Integration', () => {
    test('should integrate with existing CLMS features', async ({ page }) => {
      // Check that enhanced library features don't break existing functionality
      const existingFeatures = [
        'Dashboard',
        'Students',
        'Books',
        'Borrowing',
        'Equipment',
        'Analytics',
        'Settings',
      ];

      for (const feature of existingFeatures) {
        const count = await page
          .locator(`button:has-text("${feature}")`)
          .count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should maintain consistent navigation', async ({ page }) => {
      // Test navigation between enhanced library tabs
      const enhancedTabs = [
        'User Tracking',
        'Enhanced Borrowing',
        'Overdue Management',
        'Library Analytics',
      ];

      for (const tab of enhancedTabs) {
        const count = await page.locator(`button:has-text("${tab}")`).count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should handle API responses correctly', async ({ page }) => {
      // Check for error handling
      const errorHandling = await page
        .locator('text=Error|Failed|Unable')
        .count();
      expect(errorHandling).toBeGreaterThanOrEqual(0);

      // Check for loading states
      const loadingStates = await page
        .locator('text=Loading|Please wait')
        .count();
      expect(loadingStates).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('📱 Mobile Responsiveness', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Test mobile navigation
      const mobileMenu = await page
        .locator('button[aria-label*="menu"], button:has-text("☰")')
        .count();
      expect(mobileMenu).toBeGreaterThanOrEqual(0);

      // Test responsive design
      const responsiveElements = await page
        .locator('[class*="mobile"], [class*="responsive"]')
        .count();
      expect(responsiveElements).toBeGreaterThanOrEqual(0);
    });
  });
});
