const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const students = await p.students.findMany({
    take: 10,
    select: {
      student_id: true,
      first_name: true,
      last_name: true,
      section: true,
      grade_level: true,
    },
  });
  console.log('Sample students with sections:');
  console.log(JSON.stringify(students, null, 2));

  // Count how many have section
  const withSection = await p.students.count({
    where: { section: { not: null } },
  });
  const total = await p.students.count();
  console.log(`\nStudents with section: ${withSection}/${total}`);

  await p.$disconnect();
}

check().catch(e => {
  console.error(e);
  p.$disconnect();
});
