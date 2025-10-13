import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('librarian123', 12);
    
    const admin = await prisma.users.upsert({
      where: { username: 'admin' },
      update: { 
        password: hashedPassword,
        updated_at: new Date()
      },
      create: {
        id: crypto.randomUUID(),
        username: 'admin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        is_active: true,
        updated_at: new Date()
      }
    });
    
    console.log('✅ Admin user created/updated successfully!');
    console.log('Username: admin');
    console.log('Password: librarian123');
    console.log('Role:', admin.role);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
