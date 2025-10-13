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
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/ToastContainer'
import { ThemeProvider } from './contexts/ThemeContext'

// Initialize offline queue and event listeners
initializeOfflineQueue()

// Register Service Worker for PWA support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
        
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('🔄 New version available! Refresh to update.');
                if (confirm('A new version is available! Reload to update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
  console.log('🔧 Service Worker disabled in development mode');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
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
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
