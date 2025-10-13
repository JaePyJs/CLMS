const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStudents() {
  try {
    console.log('Checking existing students...\n');

    const students = await prisma.students.findMany({
      select: {
        id: true,
        student_id: true,
        first_name: true,
        last_name: true,
        grade_level: true,
        grade_category: true,
        section: true,
        is_active: true,
      },
      take: 10,
    });

    if (students.length === 0) {
      console.log('No students found in the database.');
      console.log('You may need to run the import script first.');
    } else {
      console.log(`Found ${students.length} students:\n`);

      students.forEach((student, index) => {
        console.log(`${index + 1}. ID: ${student.student_id}`);
        console.log(`   Name: ${student.first_name} ${student.last_name}`);
        console.log(`   Grade: ${student.grade_level} (${student.grade_category})`);
        console.log(`   Section: ${student.section || 'N/A'}`);
        console.log(`   Active: ${student.is_active ? 'Yes' : 'No'}`);
        console.log('');
      });

      // Test with the first active student
      const activeStudent = students.find(s => s.is_active);
      if (activeStudent) {
        console.log(`\nTesting with student: ${activeStudent.student_id} (${activeStudent.first_name} ${activeStudent.last_name})`);

        const { SelfServiceService } = require('./test-self-service.js');
        const selfService = new SelfServiceService();

        const result = await selfService.processScan(activeStudent.student_id);
        console.log('\nTest Result:', result);
      }
    }

  } catch (error) {
    console.error('Error checking students:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudents();