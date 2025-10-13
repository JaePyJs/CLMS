import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Integration test environment with real database connections
    environment: 'node',

    // Setup files for integration testing
    setupFiles: ['./src/tests/integration/setup.ts'],

    // Global setup for all integration tests
    globalSetup: ['./src/tests/integration/globalSetup.ts'],

    // Test files pattern
    include: [
      'src/tests/integration/**/*.test.ts',
      'src/tests/integration/**/*.test.js'
    ],

    // Exclude unit tests
    exclude: [
      'node_modules',
      'src/tests/unit/**',
      'src/tests/services/**',
      'src/tests/api/**'
    ],

    // Test timeout for integration tests (longer due to real API calls)
    testTimeout: 30000,

    // Hook timeout
    hookTimeout: 10000,

    // Increased memory for integration tests
    isolate: false,

    // Test threads (reduced for integration tests)
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1
      }
    },

    // Reporter for integration tests
    reporter: ['verbose', 'json', 'html'],

    // Output directory for test reports
    outputFile: {
      json: './test-results/integration-results.json',
      html: './test-results/integration-report.html'
    },

    // Global variables
    globals: true,

    // Coverage configuration
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'src/tests/**',
        'src/scripts/**',
        'dist/**',
        '**/*.d.ts'
      ],
      all: false,
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },

    // Environment variables for integration tests
    env: {
      NODE_ENV: 'test',
      INTEGRATION_TEST: 'true',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_integration_test',
      REDIS_HOST: process.env.TEST_REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.TEST_REDIS_PORT || '6380',
      JWT_SECRET: process.env.TEST_JWT_SECRET || 'test-jwt-secret-key-integration',
      CORS_ORIGIN: 'http://localhost:3000'
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