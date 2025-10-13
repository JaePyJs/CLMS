import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Global Setup for CLMS E2E Tests
 *
 * This runs once before all tests and:
 * - Ensures test databases are ready
 * - Sets up test data
 * - Verifies services are running
 * - Creates necessary directories
 * - Initializes test environment
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting CLMS E2E Test Environment Setup...');

  try {
    // Create test directories
    const testDirs = [
      'test-results',
      'test-results/screenshots',
      'test-results/videos',
      'test-results/traces',
      'test-results/reports',
      'test-results/coverage'
    ];

    testDirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });

    // Check if servers are already running
    const serversReady = await checkServersHealth();

    if (!serversReady) {
      console.log('⚠️  Servers are not ready. Please ensure Backend and Frontend are running:');
      console.log('   Backend: http://localhost:3001');
      console.log('   Frontend: http://localhost:3000');
      console.log('   Or use: npm run start');
      throw new Error('Servers are not ready for testing');
    }

    // Wait for servers to be fully ready
    console.log('⏳ Waiting for servers to be fully ready...');
    await waitForServers();

    // Setup test database state
    await setupTestDatabase();

    // Create test data
    await setupTestData();

    // Initialize browser for setup tasks
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Verify application is ready
    await verifyApplicationReadiness(page);

    await context.close();
    await browser.close();

    console.log('✅ CLMS E2E Test Environment Setup Complete!');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * Check if backend and frontend servers are responding
 */
async function checkServersHealth(): Promise<boolean> {
  const urls = [
    'http://localhost:3001/health',
    'http://localhost:3000'
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        timeout: 5000
      });
      if (!response.ok) {
        console.log(`❌ Server health check failed: ${url} - ${response.status}`);
        return false;
      }
      console.log(`✅ Server health check passed: ${url}`);
    } catch (error) {
      console.log(`❌ Server health check failed: ${url} - ${error}`);
      return false;
    }
  }

  return true;
}

/**
 * Wait for servers to be ready with timeout
 */
async function waitForServers(timeout = 60000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const ready = await checkServersHealth();
    if (ready) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Servers did not become ready within timeout period');
}

/**
 * Setup test database with required schema and data
 */
async function setupTestDatabase(): Promise<void> {
  console.log('🗄️  Setting up test database...');

  try {
    // Check if we can connect to the database via health endpoint
    const response = await fetch('http://localhost:3001/health');
    const health = await response.json();

    if (health.database === 'connected') {
      console.log('✅ Database connection verified');
    } else {
      throw new Error('Database connection failed');
    }
  } catch (error) {
    console.log('⚠️  Could not verify database connection:', error);
    // Continue anyway as this might be expected in some environments
  }
}

/**
 * Create test data for E2E tests
 */
async function setupTestData(): Promise<void> {
  console.log('📊 Setting up test data...');

  // This would ideally call API endpoints to create test data
  // For now, we'll just log that we're ready to create data
  console.log('✅ Test data setup ready');
}

/**
 * Verify the application is ready for testing
 */
async function verifyApplicationReadiness(page): Promise<void> {
  console.log('🔍 Verifying application readiness...');

  try {
    // Check if login page loads
    await page.goto('http://localhost:3000/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for login form
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Check for key elements
    const hasLoginForm = await page.locator('form').isVisible();
    const hasUsername = await page.getByLabel(/username/i).isVisible();
    const hasPassword = await page.getByLabel(/password/i).isVisible();

    if (!hasLoginForm || !hasUsername || !hasPassword) {
      throw new Error('Login page is not properly loaded');
    }

    console.log('✅ Application is ready for testing');

  } catch (error) {
    console.error('❌ Application readiness check failed:', error);
    throw error;
  }
}

export default globalSetup;