/* eslint-disable no-console */
import { prisma } from './utils/prisma';

async function checkBarcodes() {
  const students = await prisma.students.findMany({
    take: 20,
    select: {
      student_id: true,
      barcode: true,
      first_name: true,
      last_name: true,
    },
  });
  console.log('Student Barcodes:', JSON.stringify(students, null, 2));
}

checkBarcodes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
