const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

console.log('1. Starting app initialization test...');

// Test each step of initialization
async function testInitialization() {
  try {
    console.log('2. Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected');
    
    console.log('3. Testing basic middleware setup...');
    app.use(express.json());
    console.log('✅ Basic middleware configured');
    
    console.log('4. Testing basic routes setup...');
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    console.log('✅ Basic routes configured');
    
    console.log('5. Testing route imports...');
    
    // Test importing each route one by one to find the problematic one
    const routesToTest = [
      './src/routes/auth.js',
      './src/routes/students.js',
      './src/routes/books.js',
      './src/routes/activities.js',
      './src/routes/analytics.js',
      './src/routes/equipment.js',
      './src/routes/fines.js',
      './src/routes/reports.js',
    ];
    
    for (const route of routesToTest) {
      try {
        console.log(`   Testing import: ${route}`);
        // We'll just test if the files exist for now
        const fs = require('fs');
        const path = require('path');
        const routePath = path.join(__dirname, route);
        if (fs.existsSync(routePath)) {
          console.log(`   ✅ ${route} exists`);
        } else {
          console.log(`   ❌ ${route} not found`);
        }
      } catch (error) {
        console.error(`   ❌ Error with ${route}:`, error.message);
      }
    }
    
    console.log('6. Starting HTTP server...');
    const server = app.listen(3002, () => {
      console.log('✅ Test server started on port 3002');
      server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

testInitialization();