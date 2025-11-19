import { test, expect } from '@playwright/test'

test.describe('Analytics Refresh', () => {
  test('loads analytics and refreshes metrics', async ({ page }) => {
    await page.goto('/?tab=analytics')
    await expect(page.getByText('Advanced Analytics Dashboard')).toBeVisible()

    const refresh = page.getByRole('button', { name: 'Refresh' })
    await refresh.click()

    await expect(page.getByText('Library Metrics')).toBeVisible()
  })
})