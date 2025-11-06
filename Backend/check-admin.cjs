const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAndCreateAdmin() {
  try {
    console.log('\n=== Checking Users ===');
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, email: true }
    });
    
    console.log(`\nFound ${users.length} users:`);
    users.forEach(u => {
      console.log(`  - ${u.username} (${u.role}) ${u.email || 'no email'}`);
    });
    
    // Check if admin exists
    const admin = users.find(u => u.username === 'admin');
    
    if (!admin) {
      console.log('\n⚠️  Admin user NOT found. Creating admin user...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const newAdmin = await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          email: 'admin@clms.local',
          role: 'ADMIN',
          firstName: 'System',
          lastName: 'Administrator'
        }
      });
      
      console.log('✅ Admin user created successfully!');
      console.log(`   Username: admin`);
      console.log(`   Password: admin123`);
      console.log(`   Role: ${newAdmin.role}`);
    } else {
      console.log('\n✅ Admin user exists');
      console.log('   Testing password...');
      
      // Get full user with password
      const fullAdmin = await prisma.user.findUnique({
        where: { username: 'admin' }
      });
      
      const passwordMatch = await bcrypt.compare('admin123', fullAdmin.password);
      
      if (passwordMatch) {
        console.log('   ✅ Password "admin123" is correct');
      } else {
        console.log('   ❌ Password "admin123" does NOT match');
        console.log('   Updating password to "admin123"...');
        
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.update({
          where: { id: fullAdmin.id },
          data: { password: hashedPassword }
        });
        
        console.log('   ✅ Password updated successfully');
      }
    }
    
    await prisma.$disconnect();
    console.log('\n✅ Database check complete\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkAndCreateAdmin();
