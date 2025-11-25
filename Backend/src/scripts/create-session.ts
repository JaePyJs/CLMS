import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const barcode = 'S-1763957502933';
  console.log(`Creating session for student with barcode: ${barcode}`);

  const student = await prisma.students.findFirst({
    where: { barcode: barcode },
  });

  if (!student) {
    console.error('Student not found!');
    process.exit(1);
  }

  console.log('Student found:', student.id);

  // Check if already active
  const existing = await prisma.student_activities.findFirst({
    where: {
      student_id: student.id,
      status: 'ACTIVE',
    },
  });

  if (existing) {
    console.log('Student already has an active session:', existing);
    return;
  }

  const activity = await prisma.student_activities.create({
    data: {
      student_id: student.id,
      activity_type: 'SELF_SERVICE_CHECK_IN',
      description: 'Self-service check-in',
      status: 'ACTIVE',
    },
  });

  console.log('Session created:', activity);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
