import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    const users = await prisma.users.findMany();
    console.log(
      'Existing users:',
      users.map(u => u.username),
    );

    const hashedPassword = await bcrypt.hash('newpassword123', 10);

    const user = await prisma.users.upsert({
      where: { username: 'librarian' },
      update: { password: hashedPassword },
      create: {
        username: 'librarian',
        password: hashedPassword,
        role: 'LIBRARIAN',
        full_name: 'Librarian',
        email: 'librarian@example.com',
      },
    });
    console.log('Password reset/create successful for:', user.username);
  } catch (error: any) {
    console.error('Error resetting password:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
