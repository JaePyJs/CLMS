import { PrismaClient } from '@prisma/client';
import { applyMiddlewareToClient } from '@/middleware/prisma.middleware';

declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'info', 'warn']
        : ['error'],
  });

// Apply middleware for automatic ID and timestamp management
applyMiddlewareToClient(prisma);

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

process.on('beforeExit', () => {
  void prisma.$disconnect();
});

export { prisma };
export default prisma;
