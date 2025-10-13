import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Security test environment
    environment: 'node',

    // Setup files for security testing
    setupFiles: ['./src/tests/security/setup.ts'],

    // Global setup for security tests
    globalSetup: ['./src/tests/security/globalSetup.ts'],

    // Test files pattern
    include: [
      'src/tests/security/**/*.test.ts',
      'src/tests/security/**/*.test.js'
    ],

    // Exclude other tests
    exclude: [
      'node_modules',
      'src/tests/unit/**',
      'src/tests/integration/**',
      'src/tests/e2e/**',
      'src/tests/websocket/**',
      'src/tests/analytics/**',
      'src/tests/performance/**',
      'src/tests/services/**',
      'src/tests/api/**'
    ],

    // Test timeout for security tests
    testTimeout: 90000,

    // Hook timeout
    hookTimeout: 30000,

    // Run security tests sequentially
    sequence: {
      concurrent: false,
      shuffle: false
    },

    // Single thread for security tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },

    // Reporter for security tests
    reporter: ['verbose', 'json', 'html', 'junit'],

    // Output directory for test reports
    outputFile: {
      json: './test-results/security-results.json',
      html: './test-results/security-report.html',
      junit: './test-results/security-report.xml'
    },

    // Global variables
    globals: true,

    // Environment variables for security tests
    env: {
      NODE_ENV: 'test',
      SECURITY_TEST: 'true',
      DATABASE_URL: process.env.SECURITY_DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_security_test',
      REDIS_HOST: process.env.SECURITY_REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.SECURITY_REDIS_PORT || '6385',
      JWT_SECRET: process.env.SECURITY_JWT_SECRET || 'test-jwt-secret-key-security',
      CORS_ORIGIN: 'http://localhost:3000',
      TEST_PORT: '3009',
      // Security-specific settings
      TEST_MALICIOUS_PAYLOADS: 'true',
      TEST_AUTHENTICATION_BYPASS: 'true',
      TEST_RATE_LIMITING: 'true',
      TEST_SQL_INJECTION: 'true',
      TEST_XSS_ATTACKS: 'true',
      TEST_CSRF_PROTECTION: 'true'
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