import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import App from './App.tsx'
import './index.css'
import { queryClient } from './lib/query-client'
import { initializeOfflineQueue } from './lib/offline-queue'
import { AuthProvider } from './contexts/AuthContext'

// Initialize offline queue and event listeners
initializeOfflineQueue()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand={false}
        duration={4000}
        theme="system"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
          classNames: {
            error: 'bg-destructive text-destructive-foreground border-destructive',
            success: 'bg-primary text-primary-foreground border-primary',
          },
        }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)