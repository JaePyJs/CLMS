import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // E2E test environment with full system integration
    environment: 'node',

    // Setup files for E2E testing
    setupFiles: ['./src/tests/e2e/setup.ts'],

    // Global setup for E2E tests
    globalSetup: ['./src/tests/e2e/globalSetup.ts'],

    // Test files pattern
    include: [
      'src/tests/e2e/**/*.test.ts',
      'src/tests/e2e/**/*.test.js'
    ],

    // Exclude all other tests
    exclude: [
      'node_modules',
      'src/tests/unit/**',
      'src/tests/integration/**',
      'src/tests/services/**',
      'src/tests/api/**'
    ],

    // Test timeout for E2E tests (longer for full workflows)
    testTimeout: 60000,

    // Hook timeout
    hookTimeout: 30000,

    // Run tests sequentially to avoid interference
    sequence: {
      concurrent: false,
      shuffle: false
    },

    // Single thread for E2E tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },

    // Reporter for E2E tests
    reporter: ['verbose', 'json', 'html', 'junit'],

    // Output directory for test reports
    outputFile: {
      json: './test-results/e2e-results.json',
      html: './test-results/e2e-report.html',
      junit: './test-results/e2e-report.xml'
    },

    // Global variables
    globals: true,

    // Retry failed tests (E2E tests can be flaky)
    retry: 2,

    // Environment variables for E2E tests
    env: {
      NODE_ENV: 'test',
      E2E_TEST: 'true',
      DATABASE_URL: process.env.E2E_DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_e2e_test',
      REDIS_HOST: process.env.E2E_REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.E2E_REDIS_PORT || '6381',
      JWT_SECRET: process.env.E2E_JWT_SECRET || 'test-jwt-secret-key-e2e',
      CORS_ORIGIN: 'http://localhost:3000',
      TEST_PORT: '3003',
      TEST_WS_PORT: '3004'
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