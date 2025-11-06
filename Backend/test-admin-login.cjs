const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testAdminLogin() {
  try {
    console.log('\n=== Testing Admin Login ===\n');
    
    // 1. Check if admin user exists
    console.log('1. Checking if admin user exists...');
    const admin = await prisma.users.findUnique({
      where: { username: 'admin' }
    });
    
    if (!admin) {
      console.log('❌ Admin user NOT found in database!');
      console.log('\n🔧 Creating admin user...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const newAdmin = await prisma.users.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          email: 'admin@clms.test',
          full_name: 'System Administrator',
          role: 'ADMIN',
          is_active: true
        }
      });
      
      console.log('✅ Admin user created successfully!');
      console.log(`   Username: ${newAdmin.username}`);
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Role: ${newAdmin.role}`);
      console.log(`   Active: ${newAdmin.is_active}`);
      console.log('\n✅ You can now login with admin/admin123');
      
    } else {
      console.log(`✅ Admin user found!`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Email: ${admin.email || 'N/A'}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Active: ${admin.is_active}`);
      
      // 2. Test password
      console.log('\n2. Testing password "admin123"...');
      const passwordMatch = await bcrypt.compare('admin123', admin.password);
      
      if (passwordMatch) {
        console.log('✅ Password matches! Login should work.');
      } else {
        console.log('❌ Password does NOT match!');
        console.log('\n🔧 Resetting password to "admin123"...');
        
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.users.update({
          where: { id: admin.id },
          data: { password: hashedPassword }
        });
        
        console.log('✅ Password reset successfully!');
      }
    }
    
    // 3. List all users
    console.log('\n3. All users in database:');
    const allUsers = await prisma.users.findMany({
      select: {
        username: true,
        email: true,
        role: true,
        is_active: true
      }
    });
    
    allUsers.forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.username} (${user.role}) - Active: ${user.is_active}`);
    });
    
    console.log('\n✅ Test complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminLogin();
