import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
  const username = process.argv[2] || 'librarian';
  const password = process.argv[3] || 'librarian123';
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');

  console.log(`Resetting password for ${username}...`);

  try {
    const hashedPassword = await bcrypt.hash(password, rounds);

    const user = await prisma.users.update({
      where: { username },
      data: {
        password: hashedPassword,
        is_active: true,
      },
    });

    console.log('✅ Password updated successfully!');
    console.log('User:', user.username);
    console.log('New Hash:', user.password);

    // Verify immediately
    const isValid = await bcrypt.compare(password, user.password);
    console.log('✅ Verification check:', isValid);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
