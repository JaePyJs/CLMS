import { test, expect } from '@playwright/test';

// Verifies that the dev-only ErrorBoundary route renders the fallback UI
// and displays core elements like the error title and details.
test.describe('ErrorBoundary fallback (dev route)', () => {
  test('renders fallback on /dev/error with error details', async ({ page }) => {
    await page.goto('/dev/error');

    // Ensure the app rendered something
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Fallback title can vary by error classification; check a set of expected titles
    const possibleTitles = [
      /Something\s+Went\s+Wrong/i,
      /Validation\s+Error/i,
      /Network\s+Error/i,
      /Authentication\s+Error/i,
    ];

    const titleLocator = page.locator('h1');
    await expect(titleLocator).toBeVisible();
    const titleText = await titleLocator.textContent();
    expect(
      possibleTitles.some((re) => re.test(String(titleText)))
    ).toBeTruthy();

    // Error details section
    await expect(page.getByRole('heading', { level: 2, name: /Error\s+Details/i })).toBeVisible();

    // In development, a stack trace section is shown (optional visibility)
    const stackTraceToggle = page.getByText(/Stack\s+Trace\s+\(Development\s+Only\)/i);
    if (await stackTraceToggle.count() > 0) {
      await expect(stackTraceToggle.first()).toBeVisible();
    }

    // Primary actions exist
    await expect(page.getByRole('button', { name: 'Try Again', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to Dashboard', exact: true })).toBeVisible();
  });
});