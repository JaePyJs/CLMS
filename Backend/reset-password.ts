import 'dotenv/config';
import { AuthService } from './src/services/authService';
import { prisma } from './src/utils/prisma';

async function resetPassword() {
  const username = 'librarian';
  const password = 'lib123';

  console.log(`Resetting password for ${username}...`);

  try {
    const hashedPassword = await AuthService.hashPassword(password);

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
    const isValid = await AuthService.verifyPassword(password, user.password);
    console.log('✅ Verification check:', isValid);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
