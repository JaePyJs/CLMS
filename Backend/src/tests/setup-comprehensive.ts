/**
 * Vitest Global Test Setup
 *
 * This file runs before all tests to configure the test environment.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Mock environment variables for testing
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-secret-key-for-testing-only';
process.env['DATABASE_URL'] = 'file:./test.db';

// Global setup
beforeAll(async () => {
  // Initialize test database or mocks here if needed
  console.info('🧪 Test suite starting...');
});

// Global teardown
afterAll(async () => {
  console.info('🧪 Test suite complete.');
});

// Reset state before each test
beforeEach(() => {
  // Reset any mocks or state
});

// Cleanup after each test
afterEach(() => {
  // Cleanup any test artifacts
});

// Export for type support
export {};
