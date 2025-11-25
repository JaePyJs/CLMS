import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const student = await prisma.student.upsert({
      where: { studentId: 'TEST_STUDENT_001' },
      update: {},
      create: {
        studentId: 'TEST_STUDENT_001',
        firstName: 'Test',
        lastName: 'Student',
        email: 'test.student@example.com',
        course: 'BSCS',
        yearLevel: '4',
        section: 'A',
        status: 'ACTIVE',
      },
    });
    console.log('Created/Found Student:', student.studentId);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
