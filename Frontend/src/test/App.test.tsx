/* eslint-disable no-redeclare */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'

// Mock the hooks that use API
vi.mock('@/hooks/api-hooks', () => ({
  useHealthCheck: () => ({
    data: { success: true },
    isLoading: false,
  }),
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

describe('App', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
  })

  const renderWithClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  it('renders without crashing', () => {
    renderWithClient(<App />)
    expect(screen.getByText('CLMS')).toBeInTheDocument()
    expect(screen.getByText('Comprehensive Library Management System')).toBeInTheDocument()
  })

  it('displays all main tabs', () => {
    renderWithClient(<App />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Scan')).toBeInTheDocument()
    expect(screen.getByText('Equipment')).toBeInTheDocument()
    expect(screen.getByText('Automation')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('shows connection status', () => {
    renderWithClient(<App />)
    expect(screen.getAllByText(/Online|Offline/)).toHaveLength(2)
  })

  it('displays admin info', () => {
    renderWithClient(<App />)
    expect(screen.getByText('Sophia - Librarian')).toBeInTheDocument()
  })
})