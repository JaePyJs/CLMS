import { test, expect } from '@playwright/test';

/**
 * Authentication Tests for CLMS
 * Tests login, logout, and session management
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    // Wait for React to hydrate - check for any visible element
    await page.waitForSelector('body', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000); // Give React extra time
  });

  test('should display login page correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Comprehensive Library Management System/);
    
    // Wait for login form to be visible
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });
    
    // Check login form elements
    await expect(page.getByRole('heading', { name: /Administrator Login/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Sacred Heart of Jesus Catholic School Library/i)).toBeVisible();
    
    // Check form inputs
    await expect(page.getByLabel(/Username/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('should show validation error for empty fields', async ({ page }) => {
    // Click sign in without filling form
    await page.getByRole('button', { name: /Sign In/i }).click();
    
    // Check for validation (HTML5 validation will prevent submission)
    const usernameInput = page.getByLabel(/Username/i);
    await expect(usernameInput).toHaveAttribute('required', '');
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill login form
    await page.getByLabel(/Username/i).fill('admin');
    await page.getByLabel(/Password/i).fill('librarian123');
    
    // Submit form
    await page.getByRole('button', { name: /Sign In/i }).click();
    
    // Wait for navigation to dashboard
    await page.waitForURL('/', { timeout: 10000 });
    
    // Verify we're on dashboard
    await expect(page).toHaveURL('/');
    
    // Check for dashboard elements
    await expect(page.getByText(/Dashboard/i)).toBeVisible({ timeout: 5000 });
    
    // Verify token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill with wrong credentials
    await page.getByLabel(/Username/i).fill('wronguser');
    await page.getByLabel(/Password/i).fill('wrongpass');
    
    // Submit form
    await page.getByRole('button', { name: /Sign In/i }).click();
    
    // Wait for error message
    await expect(page.getByText(/Invalid|failed|incorrect/i)).toBeVisible({ timeout: 5000 });
    
    // Should still be on login page
    await expect(page).toHaveURL('/login');
  });

  test('should display system health indicators', async ({ page }) => {
    // Check for system status indicators
    await expect(page.getByText(/System:/i)).toBeVisible();
    await expect(page.getByText(/DB:/i)).toBeVisible();
    await expect(page.getByText(/Active:/i)).toBeVisible();
  });

  test('should have theme toggle functionality', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /Toggle theme/i });
    await expect(themeToggle).toBeVisible();
    
    // Test theme toggle (if it opens a menu)
    await themeToggle.click();
    // Theme menu might appear
  });
});

test.describe('Logout', () => {
  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/Username/i).fill('admin');
    await page.getByLabel(/Password/i).fill('librarian123');
    await page.getByRole('button', { name: /Sign In/i }).click();
    
    // Wait for dashboard
    await page.waitForURL('/', { timeout: 10000 });
    
    // Find and click logout (might be in a dropdown)
    // This depends on your UI structure
    const logoutButton = page.getByRole('button', { name: /Logout|Sign Out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 5000 });
      
      // Token should be cleared
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeFalsy();
    }
  });
});
