import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const student = await prisma.students.upsert({
      where: { student_id: 'TEST_STUDENT_001' },
      update: {},
      create: {
        student_id: 'TEST_STUDENT_001',
        first_name: 'Test',
        last_name: 'Student',
        email: 'test.student@example.com',
        grade_level: '12',
        section: 'A',
        barcode: 'TEST_STUDENT_001',
        is_active: true,
      },
    });
    console.log('Created/Found Student:', student.student_id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
