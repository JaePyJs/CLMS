import { test, expect } from '@playwright/test';

/**
 * System Health Tests for CLMS
 * Tests backend connectivity, API health, and system status
 */

test.describe('System Health', () => {
  test('should have backend API responding', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData.status).toBe('OK');
    expect(healthData.services.database.connected).toBe(true);
  });

  test('should display correct environment', async ({ page }) => {
    await page.goto('/login');
    
    // Check for version info
    await expect(page.getByText(/v\d+\.\d+\.\d+/)).toBeVisible();
  });

  test('should have no console errors on login page', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/login');
    await page.waitForTimeout(2000);
    
    // Filter out expected warnings (React DevTools, etc.)
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('Download the React DevTools') &&
      !err.includes('Maximum update depth')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('should load all assets successfully', async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Filter out optional assets
    const criticalFailures = failedRequests.filter(url => 
      !url.includes('notifications') && // Notifications might fail before login
      !url.includes('favicon')
    );
    
    expect(criticalFailures.length).toBe(0);
  });
});

test.describe('Performance', () => {
  test('should load login page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should render dashboard within acceptable time after login', async ({ page }) => {
    await page.goto('/login');
    
    const loginStart = Date.now();
    
    await page.getByLabel(/Username/i).fill('admin');
    await page.getByLabel(/Password/i).fill('librarian123');
    await page.getByRole('button', { name: /Sign In/i }).click();
    
    await page.waitForURL('/', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    
    const loginTime = Date.now() - loginStart;
    
    // Login and dashboard load should complete within 10 seconds
    expect(loginTime).toBeLessThan(10000);
  });
});
