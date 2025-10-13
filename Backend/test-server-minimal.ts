// Minimal server test to isolate initialization issues
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function testMinimalServer() {
  console.log('===== MINIMAL SERVER TEST =====');

  // Test 1: Database
  console.log('\n1. Testing database connection...');
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database failed:', (error as Error).message);
    process.exit(1);
  }

  // Test 2: Redis
  console.log('\n2. Testing Redis connection...');
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    await redis.connect();
    console.log('✅ Redis connected');
    await redis.quit();
  } catch (error) {
    console.error('❌ Redis failed:', (error as Error).message);
    process.exit(1);
  }

  // Test 3: Import app module
  console.log('\n3. Testing app module import...');
  try {
    const { app } = await import('./src/app.js');
    console.log('✅ App module imported');

    // Test 4: Initialize app
    console.log('\n4. Testing app initialization...');
    await app.initialize();
    console.log('✅ App initialized');

    // Test 5: Start server
    console.log('\n5. Testing server start...');
    await app.start(3001);
    console.log('✅ Server started on port 3001');
  } catch (error) {
    console.error(
      '❌ App initialization/start failed:',
      (error as Error).message,
    );
    console.error('Stack:', (error as Error).stack);
    process.exit(1);
  }
}

testMinimalServer().catch(console.error);
