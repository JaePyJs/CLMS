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
  console.log('Clearing all active check-ins...');

  // Find all active activities
  const activeActivities = await prisma.student_activities.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      student: {
        select: {
          first_name: true,
          last_name: true,
          student_id: true,
        },
      },
    },
  });

  console.log(`Found ${activeActivities.length} active check-ins:`);
  activeActivities.forEach(activity => {
    console.log(
      `  - ${activity.student.first_name} ${activity.student.last_name} (${activity.student.student_id})`,
    );
  });

  if (activeActivities.length === 0) {
    console.log('\nNo active check-ins to clear.');
    return;
  }

  // Mark all as completed
  const result = await prisma.student_activities.updateMany({
    where: {
      status: 'ACTIVE',
    },
    data: {
      status: 'COMPLETED',
      end_time: new Date(),
    },
  });

  console.log(`\n✅ Cleared ${result.count} active check-ins`);
  console.log('Active Students list should now be empty.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
