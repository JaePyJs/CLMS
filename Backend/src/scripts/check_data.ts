import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  // Check student 20212206
  const student = await prisma.students.findFirst({
    where: { student_id: '20212206' },
  });

  console.log('Student 20212206:', student);

  // Check personnel PN00038
  const personnel = await prisma.students.findFirst({
    where: { student_id: 'PN00038' },
  });

  console.log('\nPersonnel PN00038:', personnel);

  await prisma.$disconnect();
}

checkData().catch(console.error);
