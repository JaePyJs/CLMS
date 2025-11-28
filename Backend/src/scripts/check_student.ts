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
  console.log('Searching for student 20230108...');

  const student = await prisma.students.findFirst({
    where: {
      OR: [
        { id: '20230108' },
        { student_id: '20230108' },
        { barcode: '20230108' },
      ],
    },
  });

  if (student) {
    console.log('Found student:', JSON.stringify(student, null, 2));

    // Check if they have any active check-ins
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activities = await prisma.student_activities.findMany({
      where: {
        student_id: student.id,
        activity_type: {
          in: ['CHECK_IN', 'SELF_SERVICE_CHECK_IN', 'KIOSK_CHECK_IN'],
        },
        start_time: {
          gte: today,
        },
      },
      orderBy: {
        start_time: 'desc',
      },
      take: 1,
    });

    console.log('\nRecent activities:', JSON.stringify(activities, null, 2));

    if (activities.length > 0) {
      console.log('\nThis student should appear in Active Patrons list');
    } else {
      console.log(
        '\nThis student has no check-in today, will NOT appear in Active Patrons list',
      );
    }
  } else {
    console.log('Student 20230108 not found in database');
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
