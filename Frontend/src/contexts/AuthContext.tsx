import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  apiClient,
  LoginResponse,
  setAccessTokenProvider,
  setUnauthorizedHandler,
} from '@/lib/api'
import { AuthUser, authKeys, clearAuthState, fetchCurrentUser, primeAuthState } from '@/lib/auth-queries'

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

interface LogoutOptions {
  message?: string
  silent?: boolean
  severity?: 'info' | 'error'
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('clms_token'))

  const performLogout = useCallback(
    ({ message, silent, severity = 'info' }: LogoutOptions = {}) => {
      localStorage.removeItem('clms_token')
      localStorage.removeItem('clms_user')
      setToken(null)
      clearAuthState(queryClient)

      if (!silent) {
        const text = message ?? 'You have been logged out'
        if (severity === 'error') {
          toast.error(text)
        } else {
          toast.info(text)
        }
      }
    },
    [queryClient],
  )

  const authQuery = useQuery({
    queryKey: authKeys.current(),
    queryFn: fetchCurrentUser,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
    onSuccess: (currentUser) => {
      localStorage.setItem('clms_user', JSON.stringify(currentUser))
    },
  })

  const logout = useCallback(() => {
    performLogout()
  }, [performLogout])

  useEffect(() => {
    setAccessTokenProvider(() => localStorage.getItem('clms_token'))

    setUnauthorizedHandler(() => {
      performLogout({ message: 'Session expired. Please log in again.', severity: 'error' })
    })

    return () => {
      setAccessTokenProvider(() => null)
      setUnauthorizedHandler(null)
    }
  }, [performLogout])

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const response = await apiClient.post<LoginResponse>('/api/auth/login', {
          username,
          password,
        })

        if (response.success && response.data) {
          const { token: accessToken, user } = response.data

          localStorage.setItem('clms_token', accessToken)
          localStorage.setItem('clms_user', JSON.stringify(user))
          setToken(accessToken)

          queryClient.setQueryData(authKeys.current(), user)

          try {
            await primeAuthState(queryClient)
          } catch (primeError) {
            console.error('Failed to prime auth state after login:', primeError)
          }

          toast.success(`Welcome back, ${user.username}!`)
          return true
        }

        toast.error(response.error || 'Login failed')
        return false
      } catch (error) {
        console.error('Login error:', error)
        toast.error('An error occurred during login')
        return false
      }
    },
    [queryClient],
  )

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('clms_token')

    if (!storedToken) {
      performLogout({ silent: true })
      return false
    }

    setToken(storedToken)

    try {
      const currentUser = await primeAuthState(queryClient)
      queryClient.setQueryData(authKeys.current(), currentUser)
      return true
    } catch (error) {
      console.error('Auth check failed:', error)
      performLogout({ message: 'Session expired. Please log in again.', severity: 'error' })
      return false
    }
  }, [performLogout, queryClient])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const user = authQuery.data ?? null
  const isAuthenticated = Boolean(token && user)
  const isLoading = token ? authQuery.isPending : false

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      checkAuth,
    }),
    [checkAuth, isAuthenticated, isLoading, login, logout, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext