// Quick database connection test
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  console.log('Testing database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);

  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');

    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query test successful:', result);

    await prisma.$disconnect();
    console.log('✅ Disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
