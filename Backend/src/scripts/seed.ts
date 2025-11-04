import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Check if test user already exists
    const existingUser = await prisma.users.findUnique({
      where: { username: 'admin' },
    });

    if (existingUser) {
      logger.info('Test user already exists, skipping creation');
      return;
    }

    // Create test user using AuthService
    const testUser = await AuthService.register({
      username: 'admin',
      password: 'admin123',
      email: 'admin@clms.test',
      full_name: 'System Administrator',
      role: 'ADMIN',
    });

    logger.info('Test user created successfully', {
      username: testUser.user.username,
      userId: testUser.user.id,
      role: testUser.user.role,
    });

    // Create additional test users
    const librarianUser = await AuthService.register({
      username: 'librarian',
      password: 'lib123',
      email: 'librarian@clms.test',
      full_name: 'Library Staff',
      role: 'LIBRARIAN',
    });

    const assistantUser = await AuthService.register({
      username: 'assistant',
      password: 'assist123',
      email: 'assistant@clms.test',
      full_name: 'Library Assistant',
      role: 'ASSISTANT',
    });

    logger.info('Additional test users created', {
      librarian: librarianUser.user.username,
      assistant: assistantUser.user.username,
    });

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };