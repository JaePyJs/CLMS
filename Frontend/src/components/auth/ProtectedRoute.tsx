import React, { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginForm from './LoginForm'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, show login form
  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={() => {}} />
  }

  // If role is required and user doesn't have the required role
  if (requiredRole && user && !hasRequiredRole(user.role, requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this area.
          </p>
          <p className="text-sm text-muted-foreground">
            Required role: {requiredRole}<br />
            Your role: {user?.role}
          </p>
        </div>
      </div>
    )
  }

  // User is authenticated and has required role, show protected content
  return <>{children}</>
}

// Helper function to check if user has required role
function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  // Define role hierarchy
  const roleHierarchy: { [key: string]: number } = {
    'USER': 1,
    'STAFF': 2,
    'LIBRARIAN': 3,
    'ADMIN': 4
  }

  const userLevel = roleHierarchy[userRole] || 0
  const requiredLevel = roleHierarchy[requiredRole] || 0

  return userLevel >= requiredLevel
}