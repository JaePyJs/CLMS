import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120 * 1000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  retries: 1,
  workers: 2,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'on-failure', host: 'localhost', port: 9323 }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['line'],
    ['list']
  ],
  outputDir: 'test-results/',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: { mode: 'only-on-failure', fullPage: true },
    video: { mode: 'retain-on-failure', size: { width: 1280, height: 720 } },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    userAgent: 'CLMS-E2E-Test',
    colorScheme: 'light',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        contextOptions: { permissions: ['clipboard-read', 'clipboard-write'] }
      },
      testIgnore: '**/*.mobile.spec.ts',
    }
  ],
  webServer: {
    command: 'cd Frontend && npm run dev -- --port 3001',
    port: 3001,
    reuseExistingServer: true,
    timeout: 180 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});