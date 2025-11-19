import { test, expect } from '@playwright/test';

test.describe('🎯 Kiosk Interface - Simple Test', () => {
  test('🏪 Kiosk page should load and display welcome screen', async ({
    page,
  }) => {
    console.log('🚀 Navigating to kiosk interface...');

    // Navigate to kiosk interface
    await page.goto('http://localhost:3000/kiosk');

    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('networkidle');

    // Take a screenshot to see what's happening
    await page.screenshot({ path: 'kiosk-welcome-screen.png', fullPage: true });

    console.log('🔍 Checking for welcome screen elements...');

    // Check if welcome screen is visible (using CardTitle which renders as h3)
    const welcomeTitle = page.locator('h3').filter({ hasText: /Welcome to the Library/i });
    await expect(welcomeTitle).toBeVisible({ timeout: 10000 });
    
    // Check for "Tap Your ID" button
    const tapButton = page.locator('button').filter({ hasText: /Tap Your ID/i });
    await expect(tapButton).toBeVisible({ timeout: 5000 });

    console.log('✅ Kiosk welcome screen loaded successfully!');
  });

  test('📱 Kiosk should have mobile-friendly design', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000/kiosk');
    await page.waitForLoadState('networkidle');

    // Take mobile screenshot
    await page.screenshot({ path: 'kiosk-mobile-screen.png', fullPage: true });

    // Check if elements are still visible on mobile
    const welcomeTitle = page.locator('h3').filter({ hasText: /Welcome to the Library/i });
    await expect(welcomeTitle).toBeVisible({ timeout: 10000 });
    
    const tapButton = page.locator('button').filter({ hasText: /Tap Your ID/i });
    await expect(tapButton).toBeVisible({ timeout: 5000 });

    console.log('✅ Kiosk mobile design working!');
  });

  test('🔄 Kiosk should navigate to scan screen when "Tap Your ID" is clicked', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000/kiosk');
    await page.waitForLoadState('networkidle');

    // Click "Tap Your ID" button
    const tapButton = page
      .locator('button')
      .filter({ hasText: /Tap Your ID/i });
    await tapButton.click();

    // Wait for navigation and take screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'kiosk-scan-screen.png', fullPage: true });

    // Check if we're on the scan screen
    const scanTitle = page.locator('h3').filter({ hasText: /Scan Your ID/i });
    await expect(scanTitle).toBeVisible({ timeout: 10000 });

    console.log('✅ Kiosk navigation to scan screen working!');
  });
});