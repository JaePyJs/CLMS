import { test, expect } from '@playwright/test'

test('dashboard tabs are visible and can switch', async ({ page }) => {
  await page.goto('/')

  // Ensure authenticated by logging in via API and storing token
  const authenticated = await page.evaluate(async () => {
    const res = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123', rememberMe: true }),
    })
    const data = await res.json()
    if (data?.success && data?.data?.accessToken) {
      localStorage.setItem('clms_token', data.data.accessToken)
      localStorage.setItem('clms_user', JSON.stringify(data.data.user))
      return true
    }
    return false
  })
  expect(authenticated).toBeTruthy()

  await page.reload()
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()

  // Tabs presence
  await expect(page.locator('#tab-dashboard')).toBeVisible()
  await expect(page.locator('#tab-scan')).toBeVisible()
  await expect(page.locator('#tab-students')).toBeVisible()
  await expect(page.locator('#tab-books')).toBeVisible()
  await expect(page.locator('#tab-settings')).toBeVisible()

  await page.click('#tab-scan')
  await expect(page.locator('#tabpanel-scan')).toBeVisible()
  await page.click('#tab-dashboard')
  await expect(page.locator('#tabpanel-dashboard')).toBeVisible()
})