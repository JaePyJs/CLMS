const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    // Check students
    const studentCount = await prisma.students.count();
    console.log(`\n✅ Students in database: ${studentCount}`);
    
    if (studentCount > 0) {
      const sampleStudents = await prisma.students.findMany({ take: 3 });
      console.log('\n📚 Sample students:');
      sampleStudents.forEach(s => {
        console.log(`  - ${s.student_id}: ${s.first_name} ${s.last_name} (${s.grade_level})`);
      });
    }

    // Check books
    const bookCount = await prisma.books.count();
    console.log(`\n✅ Books in database: ${bookCount}`);
    
    if (bookCount > 0) {
      const sampleBooks = await prisma.books.findMany({ take: 3 });
      console.log('\n📖 Sample books:');
      sampleBooks.forEach(b => {
        console.log(`  - ${b.accession_no}: ${b.title} by ${b.author}`);
        console.log(`    Available: ${b.available_copies}/${b.total_copies}`);
      });
    }

    // Check checkouts
    const checkoutCount = await prisma.book_checkouts.count();
    console.log(`\n✅ Checkouts in database: ${checkoutCount}`);
    
    if (checkoutCount > 0) {
      const activeCheckouts = await prisma.book_checkouts.count({
        where: { status: 'ACTIVE' }
      });
      console.log(`   - Active: ${activeCheckouts}`);
      console.log(`   - Total: ${checkoutCount}`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('DATABASE STATUS:');
    if (studentCount === 0 || bookCount === 0) {
      console.log('⚠️  Need to import data before testing checkout system');
      console.log('\nNext step: Import your CSV files via the Import tab');
    } else {
      console.log('✅ Database ready for checkout system testing!');
      console.log('\nYou can now:');
      console.log('1. Open http://localhost:3000');
      console.log('2. Login with admin credentials');
      console.log('3. Navigate to "Checkout" tab');
      console.log('4. Test the checkout/return workflows');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('Error checking database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
