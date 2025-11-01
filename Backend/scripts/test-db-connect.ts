import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

async function main() {
  const url = process.env.DATABASE_URL;
  console.log('DATABASE_URL:', url);
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    const start = Date.now();
    await prisma.$connect();
    console.log('Prisma $connect succeeded in', Date.now() - start, 'ms');
    const [row] = await prisma.$queryRaw<any[]>`SELECT 1 AS ok`;
    console.log('Query result:', row);
  } catch (err) {
    console.error('Prisma connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});