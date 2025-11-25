import { prisma } from '../utils/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'Backend', '.env') });
// const prisma = new PrismaClient();

async function checkData() {
  try {
    const bookCount = await prisma.books.count();
    const studentCount = await prisma.students.count();

    console.log('==========================================');
    console.log('DATABASE STATUS CHECK');
    console.log('==========================================');
    console.log(`📚 Books in database: ${bookCount}`);
    console.log(`👥 Students in database: ${studentCount}`);
    console.log('==========================================');

    // Sample Student Check
    const sampleStudent = await prisma.students.findUnique({
      where: { student_id: '20250055' },
    });
    console.log('\n--- Sample Student Check (20250055) ---');
    if (sampleStudent) {
      console.log(
        '✅ Found:',
        sampleStudent.first_name,
        sampleStudent.last_name,
      );
      console.log(
        '   Grade:',
        sampleStudent.grade_level,
        'Section:',
        sampleStudent.section,
      );
    } else {
      console.log('❌ Student 20250055 NOT FOUND');
    }

    // Sample Book Check
    const sampleBook = await prisma.books.findUnique({
      where: { accession_no: 'GS00001' },
    });
    console.log('\n--- Sample Book Check (GS00001) ---');
    if (sampleBook) {
      console.log('✅ Found:', sampleBook.title);
      console.log('   Author:', sampleBook.author);
    } else {
      console.log('❌ Book GS00001 NOT FOUND');
    }

    if (bookCount === 0 && studentCount === 0) {
      console.log('\n⚠️  DATABASE IS EMPTY!');
      console.log('Your data was wiped by the import script.');
      console.log('\nTo restore, run:');
      console.log('  cd Backend');
      console.log('  npx tsx src/scripts/importCsv.ts');
    } else {
      console.log('\n✅ Data verification complete.');
    }
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData().catch(e => {
  console.error(e);
  process.exit(1);
});
