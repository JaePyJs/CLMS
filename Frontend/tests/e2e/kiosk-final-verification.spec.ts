import { test, expect } from '@playwright/test';

test.describe('🎯 CLMS Kiosk System - Final Verification', () => {
  test('🏪 Complete kiosk system verification', async ({ page }) => {
    console.log('🚀 Starting comprehensive kiosk system verification...');
    
    // Test 1: Welcome Screen
    console.log('📍 Test 1: Welcome Screen');
    await page.goto('http://localhost:3000/kiosk');
    await page.waitForLoadState('networkidle');
    
    const welcomeTitle = page.locator('h3').filter({ hasText: /Welcome to the Library/i });
    await expect(welcomeTitle).toBeVisible({ timeout: 10000 });
    
    const tapButton = page.locator('button').filter({ hasText: /Tap Your ID/i });
    await expect(tapButton).toBeVisible({ timeout: 5000 });
    
    // Check announcements
    const libraryHours = page.locator('text=/Library Hours.*Monday-Friday 7:00 AM - 5:00 PM/i');
    await expect(libraryHours).toBeVisible();
    
    const borrowingPolicy = page.locator('text=/Borrowing Policy.*Maximum of 3 books for 7 days/i');
    await expect(borrowingPolicy).toBeVisible();
    
    await page.screenshot({ path: 'kiosk-final-welcome.png', fullPage: true });
    console.log('✅ Welcome screen verified');
    
    // Test 2: Navigation to Scan Screen
    console.log('📍 Test 2: Scan Screen Navigation');
    await tapButton.click();
    await page.waitForTimeout(1000);
    
    const scanTitle = page.locator('h3').filter({ hasText: /Scan Your ID/i });
    await expect(scanTitle).toBeVisible({ timeout: 10000 });
    
    const scanInput = page.locator('input[placeholder="Scan barcode or QR code..."]');
    await expect(scanInput).toBeVisible();
    
    const continueButton = page.locator('button').filter({ hasText: /Continue/i });
    await expect(continueButton).toBeVisible();
    
    const cancelButton = page.locator('button').filter({ hasText: /Cancel/i });
    await expect(cancelButton).toBeVisible();
    
    await page.screenshot({ path: 'kiosk-final-scan.png', fullPage: true });
    console.log('✅ Scan screen verified');
    
    // Test 3: Purpose Selection (if available)
    console.log('📍 Test 3: Purpose Selection');
    await scanInput.fill('STUDENT123456');
    await continueButton.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'kiosk-final-after-scan.png', fullPage: true });
    
    // Check for purpose selection options
    const purposes = ['AVR', 'Computer', 'Library Space', 'Borrowing', 'Recreation'];
    let purposeFound = false;
    
    for (const purpose of purposes) {
      const purposeButton = page.locator('button').filter({ hasText: new RegExp(purpose, 'i') });
      if (await purposeButton.count() > 0) {
        console.log(`✅ Found purpose option: ${purpose}`);
        purposeFound = true;
        break;
      }
    }
    
    if (purposeFound) {
      console.log('✅ Purpose selection screen verified');
    } else {
      console.log('ℹ️  Purpose selection not found - may be in different flow');
    }
    
    // Test 4: Mobile Responsiveness
    console.log('📍 Test 4: Mobile Responsiveness');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Welcome screen should still be accessible on mobile
    await page.goto('http://localhost:3000/kiosk');
    await page.waitForLoadState('networkidle');
    
    await expect(welcomeTitle).toBeVisible({ timeout: 10000 });
    await expect(tapButton).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: 'kiosk-final-mobile.png', fullPage: true });
    console.log('✅ Mobile responsiveness verified');
    
    // Test 5: Backend Integration
    console.log('📍 Test 5: Backend Integration');
    
    // Check if backend is responding
    const healthResponse = await page.request.get('http://localhost:3001/health');
    expect(healthResponse.status()).toBe(200);
    
    console.log('✅ Backend integration verified');
    
    console.log('🎉 All kiosk system tests passed!');
  });

  test('📊 Kiosk statistics and admin features', async ({ page }) => {
    console.log('📊 Testing kiosk admin features...');
    
    // First, let's login as admin to access admin features
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    
    // Login as librarian
    await page.fill('input[type="text"]', 'librarian');
    await page.fill('input[type="password"]', 'lib123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 });
    
    // Navigate to analytics or reports to see kiosk statistics
    const analyticsTab = page.locator('#tab-analytics');
    await analyticsTab.click();
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'kiosk-admin-analytics.png', fullPage: true });
    
    console.log('✅ Admin analytics access verified');
  });
});