import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('Checking equipment/room status...\n');

  const equipment = await prisma.equipment.findMany({
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${equipment.length} rooms/equipment:\n`);
  equipment.forEach(item => {
    console.log(`  ${item.name}`);
    console.log(`    ID: ${item.id}`);
    console.log(`    Status: ${item.status}`);
    console.log(`    Category: ${item.category}`);
    console.log('');
  });

  // Check for any active equipment sessions
  const activeSessions = await prisma.student_activities.findMany({
    where: {
      activity_type: 'EQUIPMENT_USE',
      status: 'ACTIVE',
    },
  });

  if (activeSessions.length > 0) {
    console.log(
      `WARNING: Found ${activeSessions.length} active equipment sessions that might conflict!`,
    );
  } else {
    console.log(
      '✅ No active equipment sessions found - rooms should all be available',
    );
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
