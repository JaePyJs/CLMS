/**
 * Global Test Setup
 * 
 * This file sets up the test environment for all test suites.
 * It initializes the test database, sets up global mocks,
 * and configures test utilities.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TestDatabaseManager, TestDatabaseConfigs, TestEnvironmentType } from './database';

// Global test database instances
let unitDatabase: any = null;
let integrationDatabase: any = null;
let e2eDatabase: any = null;
let performanceDatabase: any = null;

// Test environment detection
const testEnvironment = process.env.TEST_ENV || TestEnvironmentType.UNIT;

/**
 * Global setup before all tests
 */
beforeAll(async () => {
  console.log(`🚀 Setting up global test environment: ${testEnvironment}`);
  
  try {
    // Setup databases based on test environment
    switch (testEnvironment) {
      case TestEnvironmentType.UNIT:
        unitDatabase = TestDatabaseManager.getInstance('unit', TestDatabaseConfigs.unit);
        await unitDatabase.setup();
        break;
        
      case TestEnvironmentType.INTEGRATION:
        integrationDatabase = TestDatabaseManager.getInstance('integration', TestDatabaseConfigs.integration);
        await integrationDatabase.setup();
        break;
        
      case TestEnvironmentType.E2E:
        e2eDatabase = TestDatabaseManager.getInstance('e2e', TestDatabaseConfigs.e2e);
        await e2eDatabase.setup();
        break;
        
      case TestEnvironmentType.PERFORMANCE:
        performanceDatabase = TestDatabaseManager.getInstance('performance', TestDatabaseConfigs.performance);
        await performanceDatabase.setup();
        break;
        
      default:
        console.warn(`Unknown test environment: ${testEnvironment}, defaulting to UNIT`);
        unitDatabase = TestDatabaseManager.getInstance('unit', TestDatabaseConfigs.unit);
        await unitDatabase.setup();
    }
    
    console.log('✅ Global test environment setup completed');
  } catch (error) {
    console.error('❌ Failed to setup global test environment:', error);
    throw error;
  }
});

/**
 * Global cleanup after all tests
 */
afterAll(async () => {
  console.log('🧹 Cleaning up global test environment...');
  
  try {
    // Cleanup all databases
    await TestDatabaseManager.cleanupAll();
    console.log('✅ Global test environment cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup global test environment:', error);
  }
});

/**
 * Reset databases before each test (if configured)
 */
beforeEach(async () => {
  try {
    // Reset databases that are configured to reset before each test
    if (unitDatabase && TestDatabaseConfigs.unit.resetBeforeEachTest) {
      await unitDatabase.reset();
    }
    
    if (integrationDatabase && TestDatabaseConfigs.integration.resetBeforeEachTest) {
      await integrationDatabase.reset();
    }
    
    // E2E and Performance tests typically don't reset between tests
    // to maintain state across the test suite
  } catch (error) {
    console.error('❌ Failed to reset test database:', error);
  }
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Perform any per-test cleanup here
  // This is useful for cleaning up resources that might
  // persist between tests even with transaction rollback
});

/**
 * Get the appropriate test database for the current environment
 */
export function getTestDatabase() {
  switch (testEnvironment) {
    case TestEnvironmentType.UNIT:
      return unitDatabase;
    case TestEnvironmentType.INTEGRATION:
      return integrationDatabase;
    case TestEnvironmentType.E2E:
      return e2eDatabase;
    case TestEnvironmentType.PERFORMANCE:
      return performanceDatabase;
    default:
      return unitDatabase;
  }
}

/**
 * Get Prisma client for the current test environment
 */
export function getTestPrisma() {
  const database = getTestDatabase();
  return database ? database.getPrismaClient() : null;
}

/**
 * Execute operation within transaction for the current test environment
 */
export async function withTestTransaction<T>(
  operation: (prisma: any) => Promise<T>,
  autoRollback: boolean = true
): Promise<T> {
  const database = getTestDatabase();
  if (!database) {
    throw new Error('Test database not available');
  }
  
  return await database.withTransaction(operation, autoRollback);
}

/**
 * Get test database statistics
 */
export function getTestDatabaseStats() {
  return TestDatabaseManager.getAllStats();
}

/**
 * Get test database health status
 */
export function getTestDatabaseHealth() {
  return TestDatabaseManager.getAllHealthStatuses();
}

/**
 * Wait for test database to be ready
 */
export async function waitForTestDatabase(timeout: number = 30000): Promise<void> {
  const database = getTestDatabase();
  if (database) {
    await database.waitForReady(timeout);
  }
}

/**
 * Export test environment utilities
 */
export { TestEnvironmentType, TestDatabaseConfigs };
export default {
  getTestDatabase,
  getTestPrisma,
  withTestTransaction,
  getTestDatabaseStats,
  getTestDatabaseHealth,
  waitForTestDatabase,
  TestEnvironmentType,
  TestDatabaseConfigs
};