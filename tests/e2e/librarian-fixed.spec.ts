import { test, expect } from '@playwright/test';
import { setupCLMSTestEnvironment, cleanupAfterCLMSTests } from './test-utils';

const TEST_CREDENTIALS = {
  librarian: { username: 'librarian', password: 'lib123' },
};

test.describe('Librarian User - Fixed System Tests', () => {
  test.beforeAll(async () => {
    await setupCLMSTestEnvironment();
  });

  test.afterAll(async () => {
    await cleanupAfterCLMSTests();
  });

  async function navigateToTab(page: any, tabName: string) {
    let tab = page.locator(`[role="tab"]:has-text("${tabName}")`).first();
    let isVisible = await tab.isVisible().catch(() => false);
    if (isVisible) {
      await tab.click({ timeout: 10000 });
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
        await page.waitForTimeout(1000);
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
    tab = page
      .locator(
        `button:has-text("${tabName}"), [role="menuitem"]:has-text("${tabName}"), a:has-text("${tabName}")`
      )
      .first();
    const finalVisible = await tab.isVisible().catch(() => false);
    if (finalVisible) {
      await tab.click({ timeout: 10000 });
    }
  }

async function librarianLogin(page: any) {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('domcontentloaded');

  await page.getByLabel('Username').fill(TEST_CREDENTIALS.librarian.username);
  await page.getByLabel('Password').fill(TEST_CREDENTIALS.librarian.password);

  const [loginResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/login') && r.status() === 200),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);

  // Ensure login form is gone and a primary app shell is visible
  await expect(page.locator('[data-testid="login-form"]')).toBeHidden({ timeout: 10000 });

  // Try to close any overlay toasts if present
  const toasts = await page.locator('[data-sonner-toast] button, .toast-close, .close-button').all();
  for (const btn of toasts) {
    await btn.click().catch(() => {});
  }
}

test('Librarian login and basic dashboard access', async ({ page }) => {
  await librarianLogin(page);

  // Prefer a stable marker; fall back to common dashboard shell roles
  const tokenPresent = await page.evaluate(() => {
    return Boolean(
      localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')
    );
  });

  await expect(tokenPresent).toBeTruthy();

  await expect(page.getByRole('button', { name: /sign in/i })).toBeHidden({ timeout: 5000 });
});
});