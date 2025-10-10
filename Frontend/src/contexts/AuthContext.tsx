import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { toast } from 'sonner'
import { apiClient, LoginResponse } from '@/lib/api'

interface User {
  id: string
  username: string
  role: string
}

interface AuthContextType {
  user: User | null
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('clms_token')
      const userStr = localStorage.getItem('clms_user')

      if (!token || !userStr) {
        setIsLoading(false)
        setIsAuthenticated(false)
        setUser(null)
        return false
      }

      // Parse user data
      const userData = JSON.parse(userStr) as User
      
      // Verify token with backend (optional but recommended)
      // For now, we'll just validate the token exists and user data is valid
      if (userData && userData.id && userData.username) {
        setUser(userData)
        setIsAuthenticated(true)
        setIsLoading(false)
        return true
      } else {
        // Invalid user data, clear storage
        localStorage.removeItem('clms_token')
        localStorage.removeItem('clms_user')
        setIsLoading(false)
        setIsAuthenticated(false)
        setUser(null)
        return false
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      // Clear invalid data
      localStorage.removeItem('clms_token')
      localStorage.removeItem('clms_user')
      setIsLoading(false)
      setIsAuthenticated(false)
      setUser(null)
      return false
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await apiClient.post<LoginResponse>('/api/auth/login', {
        username,
        password
      })

      if (response.success && response.data) {
        // Store JWT token
        localStorage.setItem('clms_token', response.data.token)
        
        // Store user info
        localStorage.setItem('clms_user', JSON.stringify(response.data.user))
        
        // Update state
        setUser(response.data.user)
        setIsAuthenticated(true)
        
        toast.success(`Welcome back, ${response.data.user.username}!`)
        return true
      } else {
        toast.error(response.error || 'Login failed')
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('An error occurred during login')
      return false
    }
  }

  const logout = () => {
    // Clear storage
    localStorage.removeItem('clms_token')
    localStorage.removeItem('clms_user')
    
    // Update state
    setUser(null)
    setIsAuthenticated(false)
    
    toast.info('You have been logged out')
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  }

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