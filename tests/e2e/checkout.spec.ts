import { test, expect } from '@playwright/test'
import { loginWithCredentials, assertLoggedIn, navigateToTab } from './test-utils'

test('checkout tab loads', async ({ page }) => {
  await loginWithCredentials(page, { username: 'librarian', password: 'lib123' })
  await assertLoggedIn(page)

  await navigateToTab(page, 'Checkout')
  await expect(page.locator('#tabpanel-checkout')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('h2:has-text("Book Checkout & Return")')).toBeVisible({ timeout: 10000 })
})