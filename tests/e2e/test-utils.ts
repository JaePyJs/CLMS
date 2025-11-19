/**
 * Test utilities for CLMS Playwright tests (E2E directory)
 */
import { expect } from '@playwright/test'

export async function setupCLMSTestEnvironment() {
  console.log('🚀 Setting up CLMS test environment...');

  try {
    const backendResponse = await fetch('http://localhost:3001/health');
    if (backendResponse.ok) {
      console.log('✅ Backend is already running');
    } else {
      console.log('⚠️  Backend is running but not responding correctly');
    }
  } catch {
    console.log('⚠️  Backend is not accessible');
  }

  try {
    const frontendResponse = await fetch('http://localhost:3000');
    if (frontendResponse.ok) {
      console.log('✅ Frontend is already running');
    } else {
      console.log('⚠️  Frontend is running but not responding correctly');
    }
  } catch {
    console.log('⚠️  Frontend is not accessible');
  }

  console.log('✅ Test environment setup completed');
}

export async function cleanupAfterCLMSTests() {
  console.log('🧹 Cleaning up after CLMS tests...');
}

export async function loginWithCredentials(page: any, creds: { username: string; password: string }) {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('domcontentloaded');

  await page.getByLabel('Username').fill(creds.username);
  await page.getByLabel('Password').fill(creds.password);

  await Promise.all([
    page.waitForResponse((r: any) => r.url().endsWith('/api/auth/login') && r.status() === 200),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);

  await expect(page.locator('[data-testid="login-form"]')).toBeHidden({ timeout: 10000 });
}

export async function assertLoggedIn(page: any) {
  const tokenPresent = await page.evaluate(() => {
    return Boolean(
      localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')
    );
  });
  await expect(tokenPresent).toBeTruthy();
}

export async function navigateToTab(page: any, tabName: string) {
  let tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') }).first();
  let isVisible = await tab.isVisible().catch(() => false);
  if (isVisible) {
    await tab.click({ timeout: 10000 });
    return;
  }
  const value = tabName.toLowerCase();
  const idSelector = `#tab-${value}`;
  const idTab = page.locator(idSelector).first();
  const idVisible = await idTab.isVisible().catch(() => false);
  if (idVisible) {
    await idTab.click({ timeout: 10000 });
    return;
  }
  const mobileNavPatterns = [
    'button:has(img[alt*="menu"])',
    'button[aria-label*="menu"]',
    'button:has-text("☰")',
    'button:has-text("Menu")',
    '[role="button"]:has(img[alt*="nav"])',
    'button[class*="menu"]',
    'button[class*="nav"]',
  ];
  for (const pattern of mobileNavPatterns) {
    const navButton = page.locator(pattern).first();
    const buttonVisible = await navButton.isVisible().catch(() => false);
    if (buttonVisible) {
      await navButton.click();
      await page.waitForTimeout(500);
      tab = page
        .locator(
          `button:has-text("${tabName}"), [role="menuitem"]:has-text("${tabName}"), a:has-text("${tabName}")`
        )
        .first();
      const tabVisible = await tab.isVisible().catch(() => false);
      if (tabVisible) {
        await tab.click({ timeout: 10000 });
        return;
      }
    }
  }
}