console.log('[TEST] About to import app module...');
try {
  require('./src/app');
  console.log('[TEST] App module imported successfully!');
} catch (error) {
  console.log('[TEST] Error importing app module:', error);
  process.exit(1);
}
console.log(
  '[TEST] Test completed - if you see this, app.ts loaded without crashing',
);
