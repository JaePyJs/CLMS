import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple barcode validation function
function validateBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') return false;
  return barcode.length >= 3 && barcode.length <= 50;
}

async function main() {
  const barcode = 'S-1763957502933';
  console.log(`Checking for student with barcode: ${barcode}`);

  const isValid = validateBarcode(barcode);
  console.log(`Barcode validation result: ${isValid}`);

  const student = await prisma.students.findFirst({
    where: { barcode: barcode },
  });

  if (student) {
    console.log('Student found:', student);
    // Check for active activities
    const activities = await prisma.student_activities.findMany({
      where: { student_id: student.id, status: 'ACTIVE' },
    });
    console.log('Active activities:', activities);
  } else {
    console.log('Student NOT found by barcode.');

    // Find by student_id
    const studentById = await prisma.students.findFirst({
      where: { student_id: barcode },
    });

    if (studentById) {
      console.log('Student found by ID:', studentById);
      console.log('Updating barcode...');
      const updated = await prisma.students.update({
        where: { id: studentById.id },
        data: { barcode: barcode },
      });
      console.log('Student updated:', updated);

      // Check for active activities
      const activities = await prisma.student_activities.findMany({
        where: { student_id: studentById.id, status: 'ACTIVE' },
      });
      console.log('Active activities:', activities);
    } else {
      console.log('Student NOT found by ID either.');
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
