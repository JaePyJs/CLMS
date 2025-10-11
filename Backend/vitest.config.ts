import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import 'dotenv/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup.ts'],
    environment: 'node',
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    logLevel: 'error', // Reduce test output
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})