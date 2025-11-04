import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Comprehensive Playwright Configuration for CLMS E2E Testing
 *
 * Features:
 * - Multi-browser testing (Chrome, Firefox, Safari, Edge)
 * - Multi-device testing (Desktop, Tablet, Mobile)
 * - Accessibility testing integration
 * - Performance testing with metrics
 * - Visual regression testing
 * - CI/CD integration ready
 * - Comprehensive reporting
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Global test configuration */
  timeout: 120 * 1000, // 2 minutes per test for complex workflows
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry configuration */
  retries: process.env.CI ? 3 : 1, // More retries on CI due to network variability

  /* Worker configuration for parallel execution */
  workers: process.env.CI ? 2 : 4, // Balanced parallel execution

  /* Comprehensive reporting configuration */
  reporter: [
    ['html', {
      outputFolder: 'playwright-report',
      open: process.env.CI ? 'never' : 'on-failure',
      host: 'localhost',
      port: 9323
    }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['line'], // Console output
    ['list'] // Detailed list format
  ],

  /* Global test setup */
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

  /* Test output directory */
  outputDir: 'test-results/',

  /* Shared settings for all projects */
  use: {
    /* Base URL configuration */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Trace configuration for debugging */
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',

    /* Screenshot configuration */
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },

    /* Video recording for failed tests */
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 }
    },

    /* Action and navigation timeouts */
    actionTimeout: 15000,
    navigationTimeout: 30000,

    /* Locale and timezone */
    locale: 'en-US',
    timezoneId: 'America/New_York',

    /* User agent */
    userAgent: 'CLMS-E2E-Test',

    /* Color scheme preference */
    colorScheme: 'light',

    },

  /* Configure projects for comprehensive cross-browser testing */
  projects: [
    /* Desktop browsers */
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write']
        }
      },
      testIgnore: '**/*.mobile.spec.ts',
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      testIgnore: '**/*.mobile.spec.ts',
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      testIgnore: '**/*.mobile.spec.ts',
    },

    /* Tablet testing */
    {
      name: 'ipad-tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write']
        }
      },
      testIgnore: '**/*.desktop.spec.ts',
    },
    {
      name: 'android-tablet',
      use: {
        ...devices['Galaxy Tab S4'],
        viewport: { width: 712, height: 1138 }
      },
      testIgnore: '**/*.desktop.spec.ts',
    },

    /* Mobile testing */
    {
      name: 'iphone-mobile',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 },
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write']
        }
      },
      testMatch: '**/*.mobile.spec.ts',
    },
    {
      name: 'android-mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 }
      },
      testMatch: '**/*.mobile.spec.ts',
    },

    /* Accessibility testing project */
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: '**/*.accessibility.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    /* Visual regression testing */
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        screenshot: 'only-on-failure',
      },
      testMatch: '**/*.visual.spec.ts',
      dependencies: ['chromium-desktop'],
    },

    /* Performance testing */
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: '**/*.performance.spec.ts',
    },

    /* API integration testing */
    {
      name: 'api-integration',
      testMatch: '**/*.api.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  /* Development server configuration */
  webServer: [
    {
      command: 'cd Backend && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000, // 3 minutes startup timeout for stability
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'cd Frontend && npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  ],

  /* Metadata for reporting */
  metadata: {
    'Test Environment': process.env.NODE_ENV || 'test',
    'Browser': 'Playwright',
    'Test Suite': 'CLMS E2E Tests',
    'Application': 'Comprehensive Library Management System',
    'Version': '1.0.0',
  },
});
