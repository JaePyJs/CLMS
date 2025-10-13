import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Analytics test environment
    environment: 'node',

    // Setup files for analytics testing
    setupFiles: ['./src/tests/analytics/setup.ts'],

    // Global setup for analytics tests
    globalSetup: ['./src/tests/analytics/globalSetup.ts'],

    // Test files pattern
    include: [
      'src/tests/analytics/**/*.test.ts',
      'src/tests/analytics/**/*.test.js'
    ],

    // Exclude other tests
    exclude: [
      'node_modules',
      'src/tests/unit/**',
      'src/tests/integration/**',
      'src/tests/e2e/**',
      'src/tests/websocket/**',
      'src/tests/services/**',
      'src/tests/api/**'
    ],

    // Test timeout for analytics tests (longer due to data processing)
    testTimeout: 120000,

    // Hook timeout
    hookTimeout: 60000,

    // Allow some concurrency for analytics tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1
      }
    },

    // Reporter for analytics tests
    reporter: ['verbose', 'json', 'html'],

    // Output directory for test reports
    outputFile: {
      json: './test-results/analytics-results.json',
      html: './test-results/analytics-report.html'
    },

    // Global variables
    globals: true,

    // Environment variables for analytics tests
    env: {
      NODE_ENV: 'test',
      ANALYTICS_TEST: 'true',
      DATABASE_URL: process.env.ANALYTICS_DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_analytics_test',
      REDIS_HOST: process.env.ANALYTICS_REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.ANALYTICS_REDIS_PORT || '6383',
      JWT_SECRET: process.env.ANALYTICS_JWT_SECRET || 'test-jwt-secret-key-analytics',
      CORS_ORIGIN: 'http://localhost:3000',
      TEST_PORT: '3007'
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