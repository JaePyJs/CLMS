// Check existing activities
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkActivities() {
  // Count total activities
  const totalActivities = await prisma.student_activities.count();
  console.log('Total student activities:', totalActivities);

  // Count by activity type
  const byType = await prisma.student_activities.groupBy({
    by: ['activity_type'],
    _count: { id: true },
  });
  console.log('\nActivities by type:');
  byType.forEach(t => console.log(`  ${t.activity_type}: ${t._count.id}`));

  // Get sample recent activities
  const recent = await prisma.student_activities.findMany({
    take: 10,
    orderBy: { start_time: 'desc' },
    select: {
      activity_type: true,
      start_time: true,
      status: true,
      student: {
        select: { student_id: true, first_name: true },
      },
    },
  });
  console.log('\nRecent 10 activities:');
  recent.forEach(a => {
    console.log(
      `- ${a.student?.student_id} (${a.activity_type}) @ ${a.start_time}`,
    );
  });

  await prisma.$disconnect();
}

checkActivities().catch(console.error);
