const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    const user = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (user) {
      console.log('Admin user found:');
      console.log('ID:', user.id);
      console.log('Username:', user.username);
      console.log('Role:', user.role);
      console.log('Is Active:', user.isActive);
      console.log('Password (hashed):', user.password.substring(0, 20) + '...');
    } else {
      console.log('Admin user NOT FOUND!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
