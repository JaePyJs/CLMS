import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Performance test environment
    environment: 'node',

    // Setup files for performance testing
    setupFiles: ['./src/tests/performance/setup.ts'],

    // Global setup for performance tests
    globalSetup: ['./src/tests/performance/globalSetup.ts'],

    // Test files pattern
    include: [
      'src/tests/performance/**/*.test.ts',
      'src/tests/performance/**/*.test.js'
    ],

    // Exclude other tests
    exclude: [
      'node_modules',
      'src/tests/unit/**',
      'src/tests/integration/**',
      'src/tests/e2e/**',
      'src/tests/websocket/**',
      'src/tests/analytics/**',
      'src/tests/services/**',
      'src/tests/api/**'
    ],

    // Test timeout for performance tests (longer for load testing)
    testTimeout: 300000, // 5 minutes

    // Hook timeout
    hookTimeout: 60000,

    // Single thread for performance tests to ensure consistent measurements
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },

    // Reporter for performance tests
    reporter: ['verbose', 'json', 'html'],

    // Output directory for test reports
    outputFile: {
      json: './test-results/performance-results.json',
      html: './test-results/performance-report.html'
    },

    // Global variables
    globals: true,

    // Allow retry for performance tests (can be flaky due to system load)
    retry: 1,

    // Environment variables for performance tests
    env: {
      NODE_ENV: 'test',
      PERFORMANCE_TEST: 'true',
      DATABASE_URL: process.env.PERF_DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_performance_test',
      REDIS_HOST: process.env.PERF_REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.PERF_REDIS_PORT || '6384',
      JWT_SECRET: process.env.PERF_JWT_SECRET || 'test-jwt-secret-key-performance',
      CORS_ORIGIN: 'http://localhost:3000',
      TEST_PORT: '3008',
      // Performance-specific settings
      PERFORMANCE_WARMUP_ITERATIONS: '5',
      PERFORMANCE_BENCHMARK_ITERATIONS: '20',
      PERFORMANCE_LOAD_CONCURRENT_USERS: '100',
      PERFORMANCE_LOAD_DURATION: '60000'
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