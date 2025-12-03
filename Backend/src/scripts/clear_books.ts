import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting book database cleanup...');

  try {
    // 1. Delete all book checkouts first (foreign key dependency)
    const checkouts = await prisma.book_checkouts.deleteMany({});
    logger.info(`Deleted ${checkouts.count} book checkouts.`);

    // 2. Delete all books
    const books = await prisma.books.deleteMany({});
    logger.info(`Deleted ${books.count} books.`);

    logger.info('Book database cleared successfully.');
  } catch (error) {
    logger.error('Error clearing book database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
