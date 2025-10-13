import { PrismaClient, users_role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.users.create({
      data: {
        id: 'admin-' + Date.now(),
        username: 'admin',
        password: hashedPassword,
        email: 'admin@clms.local',
        role: users_role.SUPER_ADMIN,
        is_active: true,
        full_name: 'System Administrator',
        updated_at: new Date(),
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
