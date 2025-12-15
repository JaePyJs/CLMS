// Check activities in database for December 2025
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkActivities() {
  // Get count of activities in December 2025
  const start = new Date('2025-12-01T00:00:00');
  const end = new Date('2025-12-31T23:59:59');

  const count = await prisma.student_activities.count({
    where: {
      start_time: {
        gte: start,
        lte: end,
      },
    },
  });
  console.log(`Activities in December 2025: ${count}`);

  // Get sample of activities
  const sample = await prisma.student_activities.findMany({
    where: {
      start_time: {
        gte: start,
        lte: end,
      },
    },
    take: 10,
    orderBy: { start_time: 'desc' },
    select: {
      id: true,
      start_time: true,
      activity_type: true,
      status: true,
      student: {
        select: { student_id: true, first_name: true },
      },
    },
  });

  console.log('\nSample December activities:');
  sample.forEach(a => {
    console.log(
      `- ${a.student?.student_id} (${a.activity_type}) @ ${a.start_time} [${a.status}]`,
    );
  });

  await prisma.$disconnect();
}

checkActivities().catch(console.error);
