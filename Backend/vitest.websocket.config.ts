import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // WebSocket test environment
    environment: 'node',

    // Setup files for WebSocket testing
    setupFiles: ['./src/tests/websocket/setup.ts'],

    // Global setup for WebSocket tests
    globalSetup: ['./src/tests/websocket/globalSetup.ts'],

    // Test files pattern
    include: [
      'src/tests/websocket/**/*.test.ts',
      'src/tests/websocket/**/*.test.js'
    ],

    // Exclude other tests
    exclude: [
      'node_modules',
      'src/tests/unit/**',
      'src/tests/integration/**',
      'src/tests/e2e/**',
      'src/tests/services/**',
      'src/tests/api/**'
    ],

    // Test timeout for WebSocket tests
    testTimeout: 45000,

    // Hook timeout
    hookTimeout: 15000,

    // Isolate tests to prevent WebSocket conflicts
    isolate: true,

    // Single thread for WebSocket tests to avoid port conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },

    // Reporter for WebSocket tests
    reporter: ['verbose', 'json', 'html'],

    // Output directory for test reports
    outputFile: {
      json: './test-results/websocket-results.json',
      html: './test-results/websocket-report.html'
    },

    // Global variables
    globals: true,

    // Retry failed tests (WebSocket connections can be flaky)
    retry: 1,

    // Environment variables for WebSocket tests
    env: {
      NODE_ENV: 'test',
      WEBSOCKET_TEST: 'true',
      DATABASE_URL: process.env.WS_DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_websocket_test',
      REDIS_HOST: process.env.WS_REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.WS_REDIS_PORT || '6382',
      JWT_SECRET: process.env.WS_JWT_SECRET || 'test-jwt-secret-key-websocket',
      CORS_ORIGIN: 'http://localhost:3000',
      TEST_PORT: '3005',
      TEST_WS_PORT: '3006'
    }
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/tests': resolve(__dirname, './src/tests')
    }
  }
})