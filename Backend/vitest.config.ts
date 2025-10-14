import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import 'dotenv/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup-comprehensive.ts'],
    environment: 'node',
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**',
        '**/*.spec.ts',
        '**/factories/**',
        '**/mocks/**'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Lower thresholds for complex services
        'src/services/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '**/*.d.ts',
      'coverage/**'
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    sequence: {
      concurrent: false,
      shuffle: false
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})