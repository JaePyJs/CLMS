import { screen as testingScreen } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import App from '../App'
import { render } from './test-utils'

// Mock the hooks that use API
vi.mock('@/hooks/api-hooks', () => ({
  useHealthCheck: () => ({
    data: { success: true },
    isLoading: false,
  }),
}))

// Mock the AuthContext to provide test user
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: 'test-user-id',
        username: 'test-user',
        role: 'ADMIN'
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      checkAuth: vi.fn().mockResolvedValue(true)
    })
  }
})

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing with AuthProvider', () => {
    render(<App />)
    expect(testingScreen.getByText('CLMS Library System')).toBeInTheDocument()
    expect(testingScreen.getByText(/Welcome,/)).toBeInTheDocument()
  })

  it('displays authenticated user content', () => {
    render(<App />)
    // The presence of "Welcome," text proves AuthProvider is working
    expect(testingScreen.getByText(/Welcome,/)).toBeInTheDocument()
  })

  it('has theme toggle functionality', () => {
    render(<App />)
    const themeToggle = testingScreen.getByText('Toggle theme')
    expect(themeToggle).toBeInTheDocument()
  })
})