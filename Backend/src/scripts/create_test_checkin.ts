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
  console.log('Creating check-in for student 20230108...');

  const student = await prisma.students.findFirst({
    where: {
      student_id: '20230108',
    },
  });

  if (!student) {
    console.log('Student not found');
    return;
  }

  // Check if already has active check-in
  const existingActive = await prisma.student_activities.findFirst({
    where: {
      student_id: student.id,
      status: 'ACTIVE',
    },
  });

  if (existingActive) {
    console.log('Student already has active check-in:', existingActive.id);
    return;
  }

  // Create check-in
  const activity = await prisma.student_activities.create({
    data: {
      student_id: student.id,
      activity_type: 'CHECK_IN',
      description: 'Test check-in for drag-and-drop',
      status: 'ACTIVE',
      metadata: JSON.stringify({
        purpose: 'library',
        testCheckIn: true,
      }),
    },
  });

  console.log('Created check-in:', activity.id);
  console.log('Student should now appear in Active Patrons list');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
