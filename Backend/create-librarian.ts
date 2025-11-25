import { prisma } from './src/utils/prisma.js';
import bcrypt from 'bcryptjs';

async function createLibrarian() {
  const username = 'librarian';
  const password = 'lib123';

  const existing = await prisma.users.findUnique({ where: { username } });

  if (existing) {
    console.log('✅ Librarian user already exists:', existing.username);
    console.log('   ID:', existing.id);
    console.log('   Role:', existing.role);
    return existing;
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.users.create({
    data: {
      username,
      password: hash,
      role: 'LIBRARIAN',
      is_active: true,
      full_name: 'Librarian User',
    },
  });

  console.log('✅ Created librarian user:', user.username);
  console.log('   ID:', user.id);
  console.log('   Role:', user.role);
  return user;
}

createLibrarian()
  .then(() => {
    console.log('\n🎉 Success! You can now login with:');
    console.log('   Username: librarian');
    console.log('   Password: lib123');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
