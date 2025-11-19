import { test, expect } from '@playwright/test'

test('login succeeds with seeded admin', async ({ page }) => {
  await page.goto('/')

  const success = await page.evaluate(async () => {
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
  expect(success).toBeTruthy()
  await page.reload()
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 20000 })
})