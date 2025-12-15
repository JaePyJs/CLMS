import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAndCreateLibrarian() {
  try {
    console.log('Checking for librarian user...');

    // Check if librarian exists
    const librarian = await prisma.users.findUnique({
      where: { username: 'librarian' },
    });

    if (librarian) {
      console.log('Librarian exists:', {
        id: librarian.id,
        username: librarian.username,
        role: librarian.role,
        is_active: librarian.is_active,
      });

      // Reset password to lib123
      console.log('Resetting password to lib123...');
      const hash = await bcrypt.hash('lib123', 12);
      await prisma.users.update({
        where: { username: 'librarian' },
        data: { password: hash, is_active: true },
      });
      console.log('Password reset successfully!');
    } else {
      console.log('Librarian does not exist. Creating...');
      const hash = await bcrypt.hash('lib123', 12);
      await prisma.users.create({
        data: {
          username: 'librarian',
          password: hash,
          role: 'LIBRARIAN',
          is_active: true,
          full_name: 'Librarian User',
        },
      });
      console.log('Librarian created successfully!');
    }

    console.log('\n✅ You can now login with:');
    console.log('   Username: librarian');
    console.log('   Password: lib123');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateLibrarian();
