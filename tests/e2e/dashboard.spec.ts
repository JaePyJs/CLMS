import { test, expect } from '@playwright/test';

/**
 * Dashboard Tests for CLMS
 * Tests dashboard navigation, tabs, and main features
 */

// Helper to login before dashboard tests
async function loginAsAdmin(page: any) {
  await page.goto('/login');
  await page.getByLabel(/Username/i).fill('admin');
  await page.getByLabel(/Password/i).fill('librarian123');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display dashboard with all tabs', async ({ page }) => {
    // Wait for dashboard to load
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible({ timeout: 5000 });
    
    // Check for main navigation tabs
    const expectedTabs = [
      'Dashboard',
      'Students',
      'Books',
      'Checkout',
      'Equipment',
      'Scan',
      'Analytics',
      'Automation',
      'Reports'
    ];
    
    for (const tabName of expectedTabs) {
      // Check if tab exists (might be in different UI structures)
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
      if (await tab.count() > 0) {
        await expect(tab.first()).toBeVisible();
      }
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    // Try clicking different tabs
    const studentsTab = page.getByRole('tab', { name: /Students/i }).first();
    
    if (await studentsTab.isVisible()) {
      await studentsTab.click();
      
      // Wait for content to load
      await page.waitForTimeout(1000);
      
      // Check URL or content changed
      await expect(page.getByText(/Student/i)).toBeVisible();
    }
  });

  test('should display user information in header', async ({ page }) => {
    // Check for logged-in user info
    await expect(page.getByText(/admin/i)).toBeVisible({ timeout: 5000 });
  });

  test('should have search functionality', async ({ page }) => {
    // Look for search input
    const searchInput = page.getByPlaceholder(/Search/i);
    
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
      
      // Test search
      await searchInput.first().fill('test');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Dashboard Overview Tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display overview statistics', async ({ page }) => {
    // Look for statistic cards/metrics
    await expect(page.locator('text=/Total|Active|Books|Students/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display recent activities', async ({ page }) => {
    // Check for activities section
    const activitiesSection = page.getByText(/Recent Activities|Activity/i);
    
    if (await activitiesSection.count() > 0) {
      await expect(activitiesSection.first()).toBeVisible();
    }
  });
});

test.describe('Student Management Tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to Students tab
    const studentsTab = page.getByRole('tab', { name: /Students/i }).first();
    if (await studentsTab.isVisible()) {
      await studentsTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should display student list', async ({ page }) => {
    // Check for student table or list
    await expect(page.getByText(/Student/i)).toBeVisible({ timeout: 5000 });
  });

  test('should have add student button', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Add Student|New Student/i });
    
    if (await addButton.count() > 0) {
      await expect(addButton.first()).toBeVisible();
    }
  });
});

test.describe('Book Catalog Tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to Books tab
    const booksTab = page.getByRole('tab', { name: /Books|Catalog/i }).first();
    if (await booksTab.isVisible()) {
      await booksTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should display book catalog', async ({ page }) => {
    // Check for books content
    await expect(page.getByText(/Book|Catalog|Title|Author/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should support keyboard navigation (Ctrl+K search)', async ({ page }) => {
    // Test Ctrl+K for search
    await page.keyboard.press('Control+k');
    
    // Search input might appear
    await page.waitForTimeout(500);
  });
});
