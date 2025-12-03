/**
 * Database Reset Script
 *
 * This script clears all data from the database and re-seeds with initial configuration.
 * Use this when you want a fresh start.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║        CLMS Database Reset                             ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!');
  console.log('');

  try {
    // Delete in order of dependencies (children first)
    console.log('🗑️  Clearing all tables...');

    // Student activities
    await prisma.student_activities_sections.deleteMany();
    console.log('   - student_activities_sections');

    await prisma.student_activities.deleteMany();
    console.log('   - student_activities');

    await prisma.archived_activities_sections.deleteMany();
    console.log('   - archived_activities_sections');

    await prisma.student_activities_archive.deleteMany();
    console.log('   - student_activities_archive');

    // Book checkouts (borrowing)
    await prisma.book_checkouts.deleteMany();
    console.log('   - book_checkouts');

    // Equipment sessions
    await prisma.equipment_sessions.deleteMany();
    console.log('   - equipment_sessions');

    // Printing jobs
    await prisma.printing_jobs.deleteMany();
    console.log('   - printing_jobs');

    // Stats and rewards
    await prisma.monthly_rewards.deleteMany();
    console.log('   - monthly_rewards');

    await prisma.student_scan_stats.deleteMany();
    console.log('   - student_scan_stats');

    // Notifications and logs
    await prisma.app_notifications.deleteMany();
    console.log('   - app_notifications');

    await prisma.error_logs.deleteMany();
    console.log('   - error_logs');

    // Main entities
    await prisma.books.deleteMany();
    console.log('   - books');

    await prisma.students.deleteMany();
    console.log('   - students');

    await prisma.equipment.deleteMany();
    console.log('   - equipment');

    await prisma.users.deleteMany();
    console.log('   - users');

    // Configuration tables
    await prisma.borrowing_policies.deleteMany();
    console.log('   - borrowing_policies');

    await prisma.fine_policies.deleteMany();
    console.log('   - fine_policies');

    await prisma.printing_pricing.deleteMany();
    console.log('   - printing_pricing');

    await prisma.library_sections.deleteMany();
    console.log('   - library_sections');

    await prisma.announcements.deleteMany();
    console.log('   - announcements');

    await prisma.system_settings.deleteMany();
    console.log('   - system_settings');

    console.log('');
    console.log('✅ Database cleared successfully!');
    console.log('');
    console.log(
      '📌 Next: Run SETUP_DATABASE.bat to re-seed initial configuration.',
    );
    console.log('');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase().catch(console.error);
