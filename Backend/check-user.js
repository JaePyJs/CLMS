import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAndCreateUser() {
  try {
    console.log('Connecting to database...');

    // Check if admin exists
    const admin = await prisma.users.findUnique({
      where: { username: 'admin' },
    });

    if (admin) {
      console.log('Admin user exists:', {
        username: admin.username,
        email: admin.email,
        role: admin.role,
      });
    } else {
      console.log('Admin user does not exist. Creating...');

      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const newAdmin = await prisma.users.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          email: 'admin@clms.test',
          full_name: 'System Administrator',
          role: 'ADMIN',
          is_active: true,
        },
      });

      console.log('Admin user created:', {
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
      });
    }

    await prisma.$disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkAndCreateUser();
