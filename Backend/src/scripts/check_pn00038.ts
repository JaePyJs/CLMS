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
  console.log('Searching for PN00038...');

  const record = await prisma.students.findFirst({
    where: {
      OR: [
        { id: 'PN00038' },
        { student_id: 'PN00038' },
        { barcode: 'PN00038' },
      ],
    },
  });

  if (record) {
    console.log('Found record:', JSON.stringify(record, null, 2));
  } else {
    console.log('No record found for PN00038');
    console.log('Checking all personnel...');
    const allPersonnel = await prisma.students.findMany({
      where: { type: 'PERSONNEL' },
      select: {
        id: true,
        student_id: true,
        first_name: true,
        last_name: true,
        type: true,
      },
    });
    console.log(
      `Found ${allPersonnel.length} personnel:`,
      JSON.stringify(allPersonnel, null, 2),
    );
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
