/**
 * Test utilities for CLMS Playwright tests
 */

export async function setupCLMSTestEnvironment() {
  console.log('🚀 Setting up CLMS test environment...');

  // Check if backend is running
  try {
    const backendResponse = await fetch('http://localhost:3001/health');
    if (backendResponse.ok) {
      console.log('✅ Backend is already running');
    } else {
      console.log('⚠️  Backend is running but not responding correctly');
    }
  } catch (error) {
    console.log('⚠️  Backend is not accessible');
  }

  // Check if frontend is running
  try {
    const frontendResponse = await fetch('http://localhost:3000');
    if (frontendResponse.ok) {
      console.log('✅ Frontend is already running');
    } else {
      console.log('⚠️  Frontend is running but not responding correctly');
    }
  } catch (error) {
    console.log('⚠️  Frontend is not accessible');
  }

  console.log('✅ Test environment setup completed');
}

export async function cleanupAfterCLMSTests() {
  console.log('🧹 Cleaning up after CLMS tests...');
  // Add any cleanup logic here if needed
}
