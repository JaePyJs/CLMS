import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'

interface LoginFormData {
  username: string
  password: string
}

interface LoginFormProps {
  onLoginSuccess: (user: { id: string; username: string; role: string }) => void
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const { login } = useAuth()
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please enter both username and password')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const success = await login(formData.username, formData.password)
      
      if (success) {
        // Login was successful, the AuthContext will handle the rest
        onLoginSuccess({} as any) // We don't need the user data here since AuthContext handles it
      } else {
        setError('Login failed')
      }
    } catch (err: any) {
      const errorMessage = 'An error occurred during login'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background px-4">
      {/* Background Image with Opacity */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-[0.35] dark:opacity-[0.08] pointer-events-none z-0"
        style={{ backgroundImage: `url('/Background.png')` }}
      />
      
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/src/assets/School_logo.png"
              alt="Sacred Heart of Jesus Catholic School Logo"
              className="w-16 h-16 object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Librarian Login</CardTitle>
          <CardDescription>
            Sacred Heart of Jesus Catholic School Library
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Authorized personnel only</p>
            <p className="text-xs mt-1">Contact library administrator for access</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}