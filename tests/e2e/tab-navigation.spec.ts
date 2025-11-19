import { test, expect } from '@playwright/test'

test('students and books tab navigation works', async ({ page }) => {
  await page.goto('/')

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
  await expect(page.locator('#tab-students')).toBeVisible()
  await expect(page.locator('#tab-books')).toBeVisible()

  await page.click('#tab-students')
  await expect(page.locator('#tabpanel-students')).toBeVisible()

  await page.click('#tab-books')
  await expect(page.locator('#tabpanel-books')).toBeVisible()
})