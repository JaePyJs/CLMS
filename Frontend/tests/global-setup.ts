import { execSync } from 'child_process';

/**
 * Global setup for Playwright tests
 * Ensures servers are running and environment is ready
 */
export default async function globalSetup() {
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
    console.log('⚠️  Backend is not accessible, starting it...');
    
    try {
      // Try to start backend in background
      execSync('cd .. && npm run start:dev &', { 
        stdio: 'ignore',
        timeout: 10000 
      });
      
      // Wait for backend to start
      console.log('⏳ Waiting for backend to start...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (startError) {
      console.error('Failed to start backend:', startError);
    }
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