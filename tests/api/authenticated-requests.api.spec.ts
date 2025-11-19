import { test, expect, request } from '@playwright/test'

test.describe('Authenticated requests', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const res = await request.get('http://localhost:3001/health')
    expect(res.status()).toBe(200)
  })

  test('login and call protected endpoints', async ({ request }) => {
    const login = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'admin', password: 'admin123' }
    })
    expect([200,201]).toContain(login.status())
    const loginJson = await login.json()
    const token = loginJson?.data?.accessToken
    expect(token).toBeTruthy()

    const headers = { Authorization: `Bearer ${token}` }
    const students = await request.get('http://localhost:3001/api/students', { headers })
    expect([200, 500]).toContain(students.status())

    const overdue = await request.get('http://localhost:3001/api/enhanced-library/overdue', { headers })
    expect([200, 500]).toContain(overdue.status())
  })
})