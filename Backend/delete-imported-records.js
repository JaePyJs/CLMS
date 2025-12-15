// Delete all imported attendance records to allow clean re-import with metadata
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteImportedRecords() {
  // Delete records that were from Google Sheets import (activity types from import)
  const result = await prisma.student_activities.deleteMany({
    where: {
      activity_type: {
        in: [
          'Check In',
          'Check Out',
          'Borrowed',
          'Room Use',
          'Recreation',
          'Print',
        ],
      },
    },
  });

  console.log(`Deleted ${result.count} imported attendance records`);
  console.log(
    'You can now re-import from Google Sheets to get proper metadata',
  );

  await prisma.$disconnect();
}

deleteImportedRecords().catch(console.error);
