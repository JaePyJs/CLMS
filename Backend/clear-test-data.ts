/**
 * Clear Test/Mock Data Script
 * Clears activity and transaction data while preserving core records (students, books, users)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearTestData() {
  console.log('🧹 Starting to clear test data...\n');

  try {
    // 1. Clear activity-related tables (in order to respect foreign keys)
    console.log('Clearing student activity sections...');
    const activitySections =
      await prisma.student_activities_sections.deleteMany({});
    console.log(
      `  ✅ Deleted ${activitySections.count} activity section records`,
    );

    console.log('Clearing archived activity sections...');
    const archivedSections =
      await prisma.archived_activities_sections.deleteMany({});
    console.log(
      `  ✅ Deleted ${archivedSections.count} archived section records`,
    );

    console.log('Clearing student activities...');
    const activities = await prisma.student_activities.deleteMany({});
    console.log(`  ✅ Deleted ${activities.count} activity records`);

    console.log('Clearing archived activities...');
    const archivedActivities =
      await prisma.student_activities_archive.deleteMany({});
    console.log(
      `  ✅ Deleted ${archivedActivities.count} archived activity records`,
    );

    console.log('Clearing student scan stats...');
    const scanStats = await prisma.student_scan_stats.deleteMany({});
    console.log(`  ✅ Deleted ${scanStats.count} scan stat records`);

    console.log('Clearing monthly rewards...');
    const rewards = await prisma.monthly_rewards.deleteMany({});
    console.log(`  ✅ Deleted ${rewards.count} monthly reward records`);

    // 2. Clear transaction tables
    console.log('Clearing book checkouts...');
    const checkouts = await prisma.book_checkouts.deleteMany({});
    console.log(`  ✅ Deleted ${checkouts.count} checkout records`);

    console.log('Clearing equipment sessions...');
    const equipmentSessions = await prisma.equipment_sessions.deleteMany({});
    console.log(
      `  ✅ Deleted ${equipmentSessions.count} equipment session records`,
    );

    console.log('Clearing printing jobs...');
    const printingJobs = await prisma.printing_jobs.deleteMany({});
    console.log(`  ✅ Deleted ${printingJobs.count} printing job records`);

    // 3. Clear logs and notifications
    console.log('Clearing error logs...');
    const errorLogs = await prisma.error_logs.deleteMany({});
    console.log(`  ✅ Deleted ${errorLogs.count} error log records`);

    console.log('Clearing notifications...');
    const notifications = await prisma.app_notifications.deleteMany({});
    console.log(`  ✅ Deleted ${notifications.count} notification records`);

    // 4. Reset equipment status to AVAILABLE
    console.log('Resetting equipment status to AVAILABLE...');
    const equipmentReset = await prisma.equipment.updateMany({
      data: { status: 'AVAILABLE' },
    });
    console.log(
      `  ✅ Reset ${equipmentReset.count} equipment items to AVAILABLE`,
    );

    // 5. Reset book available copies to total copies
    console.log('Resetting book availability...');
    const books = await prisma.books.findMany({
      select: { id: true, total_copies: true },
    });
    for (const book of books) {
      await prisma.books.update({
        where: { id: book.id },
        data: { available_copies: book.total_copies },
      });
    }
    console.log(`  ✅ Reset availability for ${books.length} books`);

    console.log('\n✨ All test data cleared successfully!');
    console.log('\n📊 Data preserved:');

    const studentCount = await prisma.students.count();
    const bookCount = await prisma.books.count();
    const userCount = await prisma.users.count();
    const equipmentCount = await prisma.equipment.count();

    console.log(`  - Students: ${studentCount}`);
    console.log(`  - Books: ${bookCount}`);
    console.log(`  - Users: ${userCount}`);
    console.log(`  - Equipment: ${equipmentCount}`);
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearTestData()
  .then(() => {
    console.log('\n🎉 Ready for real data testing!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to clear test data:', error);
    process.exit(1);
  });
