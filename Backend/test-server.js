const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const port = 3001;

console.log('1. Starting test server...');

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

console.log('2. Express app configured');

async function startServer() {
  try {
    console.log('3. Testing database connection...');
    await prisma.$connect();
    console.log('4. Database connected successfully');
    
    console.log('5. Starting HTTP server...');
    const server = app.listen(port, () => {
      console.log(`6. ✅ Test server running on port ${port}`);
      console.log(`   Health check: http://localhost:${port}/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Shutting down...');
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

startServer();