import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'librarian';
  const password = 'lib123';
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');

  console.log('🔐 Resetting librarian password...');

  const hash = await bcrypt.hash(password, rounds);

  const existing = await prisma.users.findUnique({ where: { username } });

  if (existing) {
    console.log('✅ Found existing librarian user, updating password...');
    await prisma.users.update({
      where: { username },
      data: { password: hash, is_active: true },
    });
    console.log('✅ Password updated successfully');
  } else {
    console.log('⚠️  Librarian user not found, creating new one...');
    await prisma.users.create({
      data: {
        username,
        password: hash,
        role: 'LIBRARIAN',
        is_active: true,
        full_name: 'Librarian User',
      },
    });
    console.log('✅ Librarian user created successfully');
  }

  console.log('');
  console.log('═══════════════════════════════════');
  console.log('   Login Credentials');
  console.log('═══════════════════════════════════');
  console.log('   Username: librarian');
  console.log('   Password: lib123');
  console.log('═══════════════════════════════════');
  console.log('');
}

main()
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
