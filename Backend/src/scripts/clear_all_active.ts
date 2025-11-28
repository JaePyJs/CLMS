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
  console.log('Finding ALL active check-ins (no date filter)...\n');

  const activeCheckIns = await prisma.student_activities.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      student: {
        select: {
          first_name: true,
          last_name: true,
          student_id: true,
          type: true,
        },
      },
    },
    orderBy: {
      start_time: 'desc',
    },
  });

  console.log(`Found ${activeCheckIns.length} active activities:\n`);
  activeCheckIns.forEach(activity => {
    console.log(
      `  ${activity.student.first_name} ${activity.student.last_name} (${activity.student.student_id})`,
    );
    console.log(`    Type: ${activity.student.type}`);
    console.log(`    Activity Type: ${activity.activity_type}`);
    console.log(`    Started: ${activity.start_time}`);
    console.log(`    Status: ${activity.status}`);
    console.log('');
  });

  if (activeCheckIns.length === 0) {
    console.log('No active activities found.');
    return;
  }

  // Clear ALL active activities
  const result = await prisma.student_activities.updateMany({
    where: {
      status: 'ACTIVE',
    },
    data: {
      status: 'COMPLETED',
      end_time: new Date(),
    },
  });

  console.log(`✅ Cleared ${result.count} active activities`);
  console.log('\nRefresh the frontend page to see empty Active Students list.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
