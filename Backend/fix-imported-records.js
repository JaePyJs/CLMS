// Fix existing imported records: add end_time 15 minutes after start_time
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixImportedRecords() {
  // Find all records with null end_time (imported records)
  const records = await prisma.student_activities.findMany({
    where: {
      end_time: null,
    },
    select: {
      id: true,
      start_time: true,
      activity_type: true,
    },
  });

  console.log(`Found ${records.length} records with null end_time`);

  // Update each record with end_time = start_time + 15 minutes
  let updated = 0;
  for (const record of records) {
    const endTime = new Date(record.start_time.getTime() + 15 * 60 * 1000);

    await prisma.student_activities.update({
      where: { id: record.id },
      data: {
        end_time: endTime,
        status: 'COMPLETED',
      },
    });
    updated++;
  }

  console.log(`Updated ${updated} records with 15-minute checkout time`);
  await prisma.$disconnect();
}

fixImportedRecords().catch(console.error);
