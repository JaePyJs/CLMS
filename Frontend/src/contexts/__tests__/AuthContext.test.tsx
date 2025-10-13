import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider, useAuth } from '@/contexts/AuthContext'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  setAccessTokenProvider: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}))

vi.mock('@/lib/auth-queries', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchCurrentUser: vi.fn(async () => ({ id: '1', username: 'admin', role: 'ADMIN' })),
    primeAuthState: vi.fn(async () => ({ id: '1', username: 'admin', role: 'ADMIN' })),
  }
})

const TestComponent = () => {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth()

  return (
    <div>
      <div data-testid="status">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="auth">{isAuthenticated ? 'authenticated' : 'guest'}</div>
      <div data-testid="user">{user?.username ?? 'none'}</div>
      <button onClick={() => login('admin', 'secret')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

const renderWithProviders = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({ success: true, data: { user: { id: '1', username: 'admin', role: 'ADMIN' } } })
    mockPost.mockResolvedValue({
      success: true,
      data: { token: 'jwt-token', user: { id: '1', username: 'admin', role: 'ADMIN' } },
    })

    window.localStorage.clear()
  })

  afterEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    window.localStorage.clear()
  })

  it('logs in and stores user data', async () => {
    renderWithProviders()

    expect(screen.getByTestId('auth').textContent).toBe('guest')

    fireEvent.click(screen.getByText('login'))

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('authenticated'))
    expect(screen.getByTestId('user').textContent).toBe('admin')
  })

  it('logs out and clears user data', async () => {
    renderWithProviders()

    fireEvent.click(screen.getByText('login'))

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('authenticated'))

    fireEvent.click(screen.getByText('logout'))

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('guest'))
    expect(screen.getByTestId('user').textContent).toBe('none')
  })
})
