import { prisma } from '../utils/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
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

    if (bookCount === 0 && studentCount === 0) {
      console.log('\n⚠️  DATABASE IS EMPTY!');
      console.log('Your data was wiped by the import script.');
      console.log('\nTo restore, run:');
      console.log('  cd Backend');
      console.log('  npx tsx src/scripts/importCsv.ts');
    } else {
      console.log('\n✅ Data exists in database!');
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
