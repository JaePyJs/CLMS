import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Mobile responsiveness test environment
    environment: 'jsdom',

    // Setup files for mobile testing
    setupFiles: ['./src/tests/mobile/setup.ts'],

    // Global setup for mobile tests
    globalSetup: ['./src/tests/mobile/globalSetup.ts'],

    // Test files pattern
    include: [
      'src/tests/mobile/**/*.test.ts',
      'src/tests/mobile/**/*.test.js',
      'src/tests/mobile/**/*.test.tsx',
      'src/tests/mobile/**/*.test.jsx'
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
      'src/tests/security/**',
      'src/tests/services/**',
      'src/tests/api/**'
    ],

    // Test timeout for mobile tests
    testTimeout: 60000,

    // Hook timeout
    hookTimeout: 20000,

    // Mobile-specific viewport settings
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        runScripts: 'dangerously'
      }
    },

    // Single thread for mobile tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },

    // Reporter for mobile tests
    reporter: ['verbose', 'json', 'html'],

    // Output directory for test reports
    outputFile: {
      json: './test-results/mobile-results.json',
      html: './test-results/mobile-report.html'
    },

    // Global variables
    globals: true,

    // Environment variables for mobile tests
    env: {
      NODE_ENV: 'test',
      MOBILE_TEST: 'true',
      DATABASE_URL: process.env.MOBILE_DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_mobile_test',
      REDIS_HOST: process.env.MOBILE_REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.MOBILE_REDIS_PORT || '6386',
      JWT_SECRET: process.env.MOBILE_JWT_SECRET || 'test-jwt-secret-key-mobile',
      CORS_ORIGIN: 'http://localhost:3000',
      TEST_PORT: '3010',
      // Mobile-specific settings
      TEST_MOBILE_VIEWPORTS: 'true',
      TEST_TOUCH_GESTURES: 'true',
      TEST_ORIENTATION_CHANGES: 'true',
      TEST_DEVICE_PIXEL_RATIO: 'true',
      TEST_MOBILE_NETWORK_CONDITIONS: 'true'
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