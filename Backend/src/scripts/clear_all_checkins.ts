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
  console.log('Clearing ALL active sessions (all activity types)...');

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all check-in activities from today that are still active
  const activeCheckIns = await prisma.student_activities.findMany({
    where: {
      activity_type: {
        in: ['CHECK_IN', 'SELF_SERVICE_CHECK_IN', 'KIOSK_CHECK_IN'],
      },
      start_time: {
        gte: today,
      },
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
  });

  console.log(`Found ${activeCheckIns.length} active check-ins from today:`);
  activeCheckIns.forEach(activity => {
    console.log(
      `  - ${activity.student.first_name} ${activity.student.last_name} (${activity.student.student_id}) [${activity.student.type}] - Activity: ${activity.activity_type}`,
    );
  });

  if (activeCheckIns.length === 0) {
    console.log('\nNo active check-ins to clear.');
    return;
  }

  // Mark all as completed
  const result = await prisma.student_activities.updateMany({
    where: {
      activity_type: {
        in: ['CHECK_IN', 'SELF_SERVICE_CHECK_IN', 'KIOSK_CHECK_IN'],
      },
      start_time: {
        gte: today,
      },
      status: 'ACTIVE',
    },
    data: {
      status: 'COMPLETED',
      end_time: new Date(),
    },
  });

  console.log(
    `\n✅ Successfully checked out ${result.count} students/personnel`,
  );
  console.log('Active Students list should now be empty after page refresh.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
