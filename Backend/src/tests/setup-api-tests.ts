import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import TestDatabaseManager from './utils/testDatabase';

// Global test database instance
let testDb: TestDatabaseManager;

// Test configuration
export const testConfig = {
  database: {
    resetBeforeEachTest: process.env.NODE_ENV === 'development',
    seedTestData: true,
    timeout: 30000 // 30 seconds
  },
  api: {
    baseUrl: process.env.TEST_API_URL || 'http://localhost:3001',
    timeout: 10000 // 10 seconds
  },
  performance: {
    enableLoadTesting: process.env.ENABLE_LOAD_TESTS === 'true',
    loadTestTimeout: 60000 // 1 minute
  },
  logging: {
    enabled: process.env.TEST_LOGGING === 'true',
    level: process.env.TEST_LOG_LEVEL || 'info'
  }
};

// Global test setup
beforeAll(async () => {
  console.log('🚀 Setting up API test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.BCRYPT_ROUNDS = '4'; // Faster hashing for tests

  // Increase timeout for database setup
  vitest.setTimeout(testConfig.database.timeout);

  try {
    // Initialize test database
    testDb = new TestDatabaseManager({
      databaseUrl: process.env.DATABASE_URL || '',
      resetBeforeEachTest: testConfig.database.resetBeforeEachTest,
      seedTestData: testConfig.database.seedTestData
    });

    await testDb.setup();
    console.log('✅ Test database setup completed');

    // Run health check
    await runHealthCheck();
    console.log('✅ System health check passed');

  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
}, 60000); // 60 second timeout for setup

// Global cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up API test environment...');

  try {
    if (testDb) {
      await testDb.cleanup();
      console.log('✅ Test database cleanup completed');
    }

    // Close any remaining connections
    await cleanupConnections();
    console.log('✅ Connections cleanup completed');

  } catch (error) {
    console.error('❌ Failed to cleanup test environment:', error);
  }
}, 30000); // 30 second timeout for cleanup

// Reset database before each test if configured
beforeEach(async () => {
  if (testConfig.database.resetBeforeEachTest && testDb) {
    await testDb.reset();
  }
});

// Cleanup after each test
afterEach(async () => {
  // Add any per-test cleanup here
  await cleanupTestArtifacts();
});

/**
 * Run system health check
 */
async function runHealthCheck(): Promise<void> {
  const { app } = await import('../app');
  const request = (await import('supertest')).default;

  try {
    const response = await request(app)
      .get('/health')
      .timeout(testConfig.api.timeout);

    if (response.status !== 200) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    console.log('Health check response:', response.body);
  } catch (error) {
    console.warn('Health check failed, continuing anyway:', error.message);
  }
}

/**
 * Cleanup database connections and other resources
 */
async function cleanupConnections(): Promise<void> {
  try {
    // Close Prisma connections
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$disconnect();

    // Close any other connections here
  } catch (error) {
    console.warn('Failed to cleanup some connections:', error.message);
  }
}

/**
 * Cleanup test artifacts and temporary files
 */
async function cleanupTestArtifacts(): Promise<void> {
  try {
    // Clean up any temporary files created during tests
    const fs = await import('fs/promises');
    const path = await import('path');

    const tempDir = path.join(process.cwd(), 'temp');
    try {
      await fs.access(tempDir);
      const files = await fs.readdir(tempDir);
      await Promise.all(files.map(file => fs.unlink(path.join(tempDir, file))));
    } catch {
      // Temp directory doesn't exist, which is fine
    }
  } catch (error) {
    console.warn('Failed to cleanup test artifacts:', error.message);
  }
}

/**
 * Get test database instance
 */
export function getTestDatabase(): TestDatabaseManager {
  if (!testDb) {
    throw new Error('Test database not initialized. Make sure setup is called first.');
  }
  return testDb;
}

/**
 * Create test-specific timeout
 */
export function createTestTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms);
  });
}

/**
 * Retry function for flaky tests
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      console.warn(`Test attempt ${attempt} failed, retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Wait for specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate test data with reasonable defaults
 */
export function generateTestData(type: string, overrides: any = {}): any {
  const faker = require('@faker-js/faker').faker;

  switch (type) {
    case 'student':
      return {
        studentId: `TEST-${faker.number.int({ min: 1000, max: 9999 })}`,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A',
        isActive: true,
        ...overrides
      };

    case 'book':
      return {
        accessionNo: `ACC-${faker.number.int({ min: 1000, max: 9999 })}`,
        title: faker.lorem.words({ min: 2, max: 5 }),
        author: `${faker.person.firstName()} ${faker.person.lastName()}`,
        category: 'Fiction',
        subcategory: 'Test Fiction',
        location: 'TEST-001',
        totalCopies: faker.number.int({ min: 1, max: 5 }),
        availableCopies: faker.number.int({ min: 0, max: 5 }),
        isActive: true,
        ...overrides
      };

    case 'equipment':
      return {
        equipmentId: `COMP-${faker.number.int({ min: 100, max: 999 })}`,
        name: `Test Computer ${faker.number.int({ min: 1, max: 50 })}`,
        type: 'COMPUTER',
        location: 'Test Lab',
        maxTimeMinutes: 60,
        requiresSupervision: false,
        status: 'AVAILABLE',
        ...overrides
      };

    case 'user':
      return {
        username: faker.internet.username(),
        password: 'testpassword123',
        role: 'LIBRARIAN',
        isActive: true,
        email: faker.internet.email(),
        fullName: `${faker.person.firstName()} ${faker.person.lastName()}`,
        ...overrides
      };

    default:
      throw new Error(`Unknown test data type: ${type}`);
  }
}

/**
 * Mock console methods to reduce test output noise
 */
export function mockConsole(quiet: boolean = true): void {
  if (quiet && !testConfig.logging.enabled) {
    const originalConsole = { ...console };

    global.console = {
      ...originalConsole,
      log: vitest.fn(),
      info: vitest.fn(),
      warn: vitest.fn(),
      error: vitest.fn(),
      debug: vitest.fn()
    };

    // Restore after tests
    afterAll(() => {
      global.console = originalConsole;
    });
  }
}

// Export for use in tests
export { testDb };