#!/usr/bin/env node

/**
 * Clear All Data Script for CLMS
 *
 * This script clears all existing data from the database and initializes it to 0
 * Perfect for starting fresh with real library data.
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

// Set __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function clearAllData() {
  console.log('🗑️  Clearing all CLMS data...\n');

  try {
    // Clear data in order of dependencies (foreign key constraints)
    console.log('Clearing activities...');
    await prisma.activity.deleteMany();

    console.log('Clearing automation jobs...');
    await prisma.automationJob.deleteMany();

    console.log('Clearing system configuration...');
    await prisma.systemConfig.deleteMany();

    console.log('Clearing books...');
    await prisma.book.deleteMany();

    console.log('Clearing equipment...');
    await prisma.equipment.deleteMany();

    console.log('Clearing students...');
    await prisma.student.deleteMany();

    console.log('Clearing users (except admin)...');
    await prisma.user.deleteMany({
      where: {
        username: {
          not: 'admin'
        }
      }
    });

    console.log('✅ All data cleared successfully!\n');

    // Verify all tables are empty
    const counts = await Promise.all([
      prisma.activity.count(),
      prisma.automationJob.count(),
      prisma.systemConfig.count(),
      prisma.book.count(),
      prisma.equipment.count(),
      prisma.student.count(),
      prisma.user.count(),
    ]);

    console.log('📊 Current table counts:');
    console.log(`  Activities: ${counts[0]}`);
    console.log(`  Automation Jobs: ${counts[1]}`);
    console.log(`  System Config: ${counts[2]}`);
    console.log(`  Books: ${counts[3]}`);
    console.log(`  Equipment: ${counts[4]}`);
    console.log(`  Students: ${counts[5]}`);
    console.log(`  Users: ${counts[6]}`);

  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute script
if (import.meta.url === `file://${process.argv[1]}`) {
  clearAllData();
}

export { clearAllData };