// Direct test of import flow
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testImport() {
  // Simulate what bulkInsertActivities does with a sample row
  const testRecords = [
    {
      studentId: '20222416',
      timestamp: new Date('2025-10-01T07:30:00'),
      action: 'Check In',
      activityType: 'ATTENDANCE_IMPORT',
    },
    {
      studentId: '20230022',
      timestamp: new Date('2025-10-01T07:35:00'),
      action: 'Check In',
      activityType: 'ATTENDANCE_IMPORT',
    },
    {
      studentId: '20230008',
      timestamp: new Date('2025-10-01T07:40:00'),
      action: 'Check In',
      activityType: 'ATTENDANCE_IMPORT',
    },
  ];

  console.log('=== Testing Import Logic ===\n');

  for (const record of testRecords) {
    console.log(`Testing student ID: "${record.studentId}"`);

    // Step 1: Try exact match (same as bulkInsertActivities)
    let student = await prisma.students.findUnique({
      where: { student_id: record.studentId },
    });

    if (student) {
      console.log(
        `  ✓ FOUND via exact match: ${student.first_name} ${student.last_name}`,
      );
    } else {
      console.log(`  ✗ NOT found via exact match`);

      // Step 2: Try contains match
      const containsMatch = await prisma.students.findMany({
        where: {
          student_id: {
            contains: record.studentId,
          },
        },
        take: 5,
      });

      if (containsMatch.length > 0) {
        console.log(`  → Found ${containsMatch.length} via contains:`);
        containsMatch.forEach(s =>
          console.log(
            `     "${s.student_id}" - ${s.first_name} ${s.last_name}`,
          ),
        );
      } else {
        console.log(`  ✗ NOT found via contains either`);
      }
    }
    console.log('');
  }

  // Also check what IDs are actually in the database
  console.log('=== Sample IDs in Database ===');
  const sample = await prisma.students.findMany({
    take: 10,
    orderBy: { student_id: 'asc' },
    select: { student_id: true, first_name: true, last_name: true },
  });
  sample.forEach(s =>
    console.log(`"${s.student_id}" - ${s.first_name} ${s.last_name}`),
  );

  await prisma.$disconnect();
}

testImport().catch(console.error);
