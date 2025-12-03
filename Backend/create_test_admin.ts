import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    const password = 'password123';
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hash = await bcrypt.hash(password, rounds);

    const user = await prisma.users.upsert({
      where: { username: 'admin_test' },
      update: { password: hash },
      create: {
        username: 'admin_test',
        password: hash,
        role: 'ADMIN',
        is_active: true,
        full_name: 'Test Admin',
      },
    });
    console.log('Created/Updated Admin:', user.username);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
