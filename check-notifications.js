// Simple script to check notifications in the database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNotifications() {
  try {
    const notifications = await prisma.app_notifications.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    console.log("Found notifications:");
    notifications.forEach((notif, index) => {
      console.log(`${index + 1}. ${notif.type} - ${notif.title}`);
      console.log(`   Message: ${notif.message}`);
      console.log(`   Priority: ${notif.priority}, Read: ${notif.read}`);
      console.log(`   Created: ${notif.createdAt}`);
      console.log("---");
    });

    const count = await prisma.app_notifications.count();
    console.log(`Total notifications: ${count}`);
  } catch (error) {
    console.error("Error checking notifications:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();