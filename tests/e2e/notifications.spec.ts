import { test, expect } from '@playwright/test';

// Verifies the NotificationCenter bell renders and opens the panel.
test.describe('NotificationCenter UI', () => {
  test('bell opens panel and shows header', async ({ page }) => {
    await page.goto('/');

    const bell = page.getByTestId('notification-center');
    await expect(bell).toBeVisible();

    await bell.click();

    // Panel header should appear
    await expect(page.getByRole('heading', { name: /Notifications/i })).toBeVisible();

    // If unauthenticated, the list may be empty; verify stable empty state text
    await expect(page.getByText(/No\s+notifications/i)).toBeVisible();
  });
});