/**
 * Global teardown for Playwright tests
 * Cleanup after tests are completed
 */
export default async function globalTeardown() {
  console.log('🧹 Cleaning up after CLMS tests...');
  
  // Add any cleanup logic here if needed
  // For example, cleaning up test data, stopping services, etc.
  
  console.log('✅ Test cleanup completed');
}