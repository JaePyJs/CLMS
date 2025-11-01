import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import 'dotenv/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup-comprehensive.ts'],
    globalSetup: ['./src/tests/setup/globalSetup.ts'],
    environment: 'node',
    globals: true,
    poolOptions: { threads: { singleThread: true } },
    include: [
      'src/tests/mobile/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: ['node_modules/', 'dist/', '**/*.d.ts', 'coverage/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: { concurrent: false, shuffle: false }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Add mobile-specific aliases here as needed
    }
  }
})