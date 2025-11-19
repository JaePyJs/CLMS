/**
 * Prisma Client Singleton
 * Provides a single Prisma Client instance across the application
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log slow queries
prisma.$on('query' as never, (e: { duration: number; query: string }) => {
  if (e.duration > 1000) {
    logger.warn('Slow query detected', {
      duration: e.duration,
      query: e.query.substring(0, 200),
    });
  }
});

export default prisma;
