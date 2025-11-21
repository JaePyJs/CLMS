
import { test, expect } from '@playwright/test';

test.describe('Comprehensive UI Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console Error: "${msg.text()}"`);
      }
    });

    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'librarian');
    await page.fill('input[type="password"]', 'lib123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Good Morning')).toBeVisible({ timeout: 10000 });
  });

  const tabs = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'scan', name: 'Activity Hub' },
    { id: 'students', name: 'Student Management' },
    { id: 'books', name: 'Book Catalog' },
    { id: 'checkout', name: 'Checkout Desk' },
    { id: 'equipment', name: 'Equipment' },
    { id: 'automation', name: 'Automation' },
    { id: 'analytics', name: 'Analytics' },
    { id: 'reports', name: 'Reports' },
    { id: 'import', name: 'Data Import' },
    { id: 'qrcodes', name: 'QR Codes' },
    { id: 'barcodes', name: 'Barcodes' },
    { id: 'settings', name: 'Settings' },
    { id: 'user-tracking', name: 'User Tracking' },
    { id: 'enhanced-borrowing', name: 'Enhanced Borrowing' },
    { id: 'overdue-management', name: 'Overdue Management' }
  ];

  for (const tab of tabs) {
    test(`should render ${tab.name} tab correctly`, async ({ page }) => {
      console.log(`Testing tab: ${tab.name} (${tab.id})`);
      
      // Navigate via query param to ensure clean state or click tab
      await page.goto(`/?tab=${tab.id}`);
      
      // Wait for network idle to ensure data loaded
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await page.screenshot({ path: `test-results/screenshots/${tab.id}.png`, fullPage: true });
      
      // Basic assertion that we are on the right tab (url check)
      expect(page.url()).toContain(`tab=${tab.id}`);
      
      // Check for critical errors in body
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application Error');
      expect(bodyText).not.toContain('Something went wrong');
    });
  }
});
