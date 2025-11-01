// Test importing TypeScript routes to see if one is causing the hang
console.log('Testing TypeScript route imports...');

async function testRouteImports() {
  const routes = [
    'auth',
    'students', 
    'books',
    'activities',
    'analytics',
    'equipment',
    'fines',
    'reports'
  ];
  
  for (const route of routes) {
    try {
      console.log(`Testing import: ${route}`);
      
      // Use dynamic import to test each route
      const routeModule = await import(`./src/routes/${route}.js`);
      console.log(`✅ ${route} imported successfully`);
      
      // Small delay to see progress
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error importing ${route}:`, error.message);
      
      // If this route fails, let's continue with others
      continue;
    }
  }
  
  console.log('Route import test completed');
  process.exit(0);
}

testRouteImports().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});