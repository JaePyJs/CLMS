import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import 'dotenv/config'

export default defineConfig({
  test: {
    // setupFiles: ['./src/tests/setup-simple.ts'], // Temporarily disabled
    environment: 'node',
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
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