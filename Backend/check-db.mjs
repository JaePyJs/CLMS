import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTable() {
  try {
    const count = await prisma.app_notifications.count();
    console.log(`Total notifications: ${count}`);
    
    if (count > 0) {
      const notifications = await prisma.app_notifications.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('Sample notifications:');
      notifications.forEach((notif, i) => {
        console.log(`${i + 1}. ${notif.type} - ${notif.title}`);
        console.log(`   Message: ${notif.message}`);
      });
    }
    
    // Check if table exists and has proper permissions
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM app_notifications`;
    console.log('Table access test:', result);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();