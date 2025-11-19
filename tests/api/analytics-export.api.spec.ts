import { test, expect } from '@playwright/test'

test.describe('Analytics export endpoint', () => {
  test('exports CSV with token', async ({ request }) => {
    const login = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'admin', password: 'admin123' }
    })
    expect([200,201]).toContain(login.status())
    const token = (await login.json())?.data?.accessToken
    expect(token).toBeTruthy()
    const res = await request.post('http://localhost:3001/api/analytics/export', {
      headers: { Authorization: `Bearer ${token}` },
      data: { format: 'csv', timeframe: 'week', sections: [] }
    })
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/csv')
    const body = await res.text()
    expect(body).toContain('Overview')
  })
})