import { test, expect } from '@playwright/test';

test.describe('CLMS Frontend Basic Functionality', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page loads successfully
    await expect(page).toHaveTitle(/CLMS/);
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check for common navigation elements
    const navigation = page.locator('nav, header, [role="navigation"]');
    await expect(navigation).toBeVisible();
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/navigation.png' });
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');
    
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.screenshot({ path: 'test-results/desktop-view.png' });
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: 'test-results/tablet-view.png' });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: 'test-results/mobile-view.png' });
  });

  test('should have working React components', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React to load
    await page.waitForLoadState('networkidle');
    
    // Check for React-specific elements
    const reactRoot = page.locator('#root, [data-reactroot]');
    await expect(reactRoot).toBeVisible();
    
    // Check for any error boundaries or error messages
    const errorMessages = page.locator('[data-testid*="error"], .error, [role="alert"]');
    await expect(errorMessages).toHaveCount(0);
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Allow some time for any async operations
    await page.waitForTimeout(2000);
    
    // Check that there are no critical console errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('404') &&
      !error.includes('network')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});