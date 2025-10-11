#!/usr/bin/env node

/**
 * Sample Data Generation Script for CLMS
 *
 * This script generates realistic sample data for demonstration purposes
 * including students, equipment, books, activities, and more.
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  students: 50,
  books: 100,
  equipment: 15,
  activities: 200,
  staffUsers: 3,
  daysOfHistory: 30
};

// Philippine school data
const PHILIPPINE_SCHOOLS = [
  'Sacred Heart of Jesus Catholic School',
  'Ateneo de Manila University',
  'De La Salle University',
  'University of the Philippines',
  'Miriam College',
  'Xavier School',
  'La Salle Green Hills',
  'St. Mary\'s College',
  'Holy Family Academy',
  'Don Bosco Technical Institute'
];

const FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Miguel', 'Carmen', 'Antonio', 'Rosa',
  'Francisco', 'Sofia', 'Juan Carlos', 'Isabella', 'Gabriel', 'Andrea',
  'Luis', 'Patricia', 'Manuel', 'Teresa', 'Pedro', 'Elena', 'Carlos',
  'Lourdes', 'Ricardo', 'Monica', 'Alberto', 'Victoria', 'Roberto',
  'Gloria', 'Eduardo', 'Beatriz', 'Fernando', 'Sofia', 'Andres'
];

const LAST_NAMES = [
  'Reyes', 'Cruz', 'Santos', 'Garcia', 'Mendoza', 'Ramos', 'Flores',
  'Torres', 'Lopez', 'Gonzales', 'Castillo', 'Morales', 'Villanueva',
  'Aquino', 'Bautista', 'Dela Cruz', 'Paredes', 'Ocampo', 'Hernandez',
  'Mendoza', 'Vargas', 'Salazar', 'Fernando', 'De Leon', 'Ignacio',
  'Marquez', 'Panganiban', 'Dizon', 'Bautista', 'De Jesus', 'Yap'
];

const EQUIPMENT_TYPES = ['Computer', 'Printer', 'Scanner', 'Tablet', 'eReader'];
const ACTIVITY_TYPES = ['Research', 'Homework', 'Reading', 'Project Work', 'Computer Use'];
const BOOK_CATEGORIES = ['Fiction', 'Non-Fiction', 'Reference', 'Educational', 'Religious'];

// Utility functions
function getRandomElement(array: string[]): string {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Data generators
async function generateUsers() {
  console.log('Generating users...');

  // Generate admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      email: 'admin@shjs.edu.ph'
    }
  });

  // Generate staff users
  const staffRoles = ['USER', 'STAFF', 'LIBRARIAN'];
  const staffUsers = [];

  for (let i = 0; i < CONFIG.staffUsers; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${getRandomInt(1, 99)}`;

    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        password: hashedPassword,
        role: staffRoles[i] as any,
        isActive: true,
        email: `${username}@shjs.edu.ph`
      }
    });

    staffUsers.push(user);
  }

  console.log(`✓ Generated 1 admin and ${CONFIG.staffUsers} staff users`);
  return { admin, staffUsers };
}

async function generateStudents() {
  console.log('Generating students...');

  const students = [];
  const grades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const sections = ['A', 'B', 'C', 'D', 'E'];

  for (let i = 0; i < CONFIG.students; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    const grade = getRandomElement(grades);
    const section = getRandomElement(sections);
    const lrn = `${Math.random().toString(10).substring(2, 12)}`;

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        grade,
        section,
        lrn,
        isActive: getRandomBoolean(0.9), // 90% active
        contactNumber: `09${Math.random().toString(10).substring(2, 10)}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${getRandomInt(1, 99)}@student.shjs.edu.ph`,
        address: `${getRandomElement(['Manila', 'Quezon City', 'Makati', 'Pasig', 'Mandaluyong'])}, Metro Manila`,
        parentName: `${getRandomElement(FIRST_NAMES)} ${getRandomElement(LAST_NAMES)}`,
        parentContact: `09${Math.random().toString(10).substring(2, 10)}`
      }
    });

    students.push(student);
  }

  console.log(`✓ Generated ${CONFIG.students} students`);
  return students;
}

async function generateEquipment() {
  console.log('Generating equipment...');

  const equipment = [];

  // Generate computers
  for (let i = 1; i <= 10; i++) {
    const equip = await prisma.equipment.create({
      data: {
        name: `Computer Station ${i}`,
        type: 'Computer',
        status: getRandomBoolean(0.8) ? 'available' : getRandomBoolean(0.5) ? 'in_use' : 'maintenance',
        location: `Computer Area ${Math.ceil(i / 5)}`,
        specifications: `Windows 11, Intel Core i5, 8GB RAM, 256GB SSD`,
        purchaseDate: getRandomDate(new Date('2022-01-01'), new Date('2024-01-01')),
        lastMaintenanceDate: getRandomDate(new Date('2024-01-01'), new Date()),
        warrantyExpiry: getRandomDate(new Date('2024-12-31'), new Date('2026-12-31')),
        notes: `Library computer station ${i}`,
        isActive: true
      }
    });
    equipment.push(equip);
  }

  // Generate printers
  for (let i = 1; i <= 3; i++) {
    const equip = await prisma.equipment.create({
      data: {
        name: `Printer ${i}`,
        type: 'Printer',
        status: getRandomBoolean(0.9) ? 'available' : 'maintenance',
        location: 'Printing Area',
        specifications: `HP LaserJet Pro, Wireless, Duplex Printing`,
        purchaseDate: getRandomDate(new Date('2023-01-01'), new Date('2024-01-01')),
        lastMaintenanceDate: getRandomDate(new Date('2024-01-01'), new Date()),
        warrantyExpiry: getRandomDate(new Date('2025-01-01'), new Date('2027-01-01')),
        notes: `Library printer ${i}`,
        isActive: true
      }
    });
    equipment.push(equip);
  }

  // Generate tablets
  for (let i = 1; i <= 2; i++) {
    const equip = await prisma.equipment.create({
      data: {
        name: `iPad ${i}`,
        type: 'Tablet',
        status: getRandomBoolean(0.8) ? 'available' : 'in_use',
        location: 'Mobile Device Area',
        specifications: `iPad Air 5th Gen, 64GB, WiFi`,
        purchaseDate: getRandomDate(new Date('2023-06-01'), new Date('2024-01-01')),
        lastMaintenanceDate: getRandomDate(new Date('2024-01-01'), new Date()),
        warrantyExpiry: getRandomDate(new Date('2025-06-01'), new Date('2026-06-01')),
        notes: `Library tablet ${i}`,
        isActive: true
      }
    });
    equipment.push(equip);
  }

  console.log(`✓ Generated ${equipment.length} equipment items`);
  return equipment;
}

async function generateBooks() {
  console.log('Generating books...');

  const books = [];
  const authors = [
    'J.K. Rowling', 'Stephen King', 'Nora Roberts', 'James Patterson',
    'Dr. Seuss', 'John Grisham', 'Danielle Steel', 'Nicholas Sparks',
    'J.R.R. Tolkien', 'George Orwell', 'J.D. Salinger', 'Harper Lee',
    'F. Scott Fitzgerald', 'Jane Austen', 'Charles Dickens', 'Mark Twain'
  ];

  for (let i = 1; i <= CONFIG.books; i++) {
    const title = faker.lorem.words({ min: 3, max: 8 }).split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    const author = getRandomElement(authors);
    const isbn = `978-${Math.random().toString(10).substring(2, 5)}-${Math.random().toString(10).substring(2, 5)}-${Math.random().toString(10).substring(2, 5)}-${Math.random().toString(10).substring(2, 1)}`;

    const book = await prisma.book.create({
      data: {
        title,
        author,
        isbn,
        category: getRandomElement(BOOK_CATEGORIES),
        status: getRandomBoolean(0.7) ? 'available' : getRandomBoolean(0.5) ? 'borrowed' : 'reserved',
        totalCopies: getRandomInt(1, 5),
        availableCopies: getRandomInt(0, 5),
        publisher: faker.company.name(),
        publishYear: getRandomInt(2015, 2024),
        pageCount: getRandomInt(100, 500),
        language: 'English',
        location: `Shelf ${String.fromCharCode(65 + getRandomInt(0, 25))}${getRandomInt(1, 20)}`,
        purchaseDate: getRandomDate(new Date('2020-01-01'), new Date('2024-01-01')),
        cost: getRandomInt(200, 2000),
        description: faker.lorem.paragraph(2),
        tags: [getRandomElement(['Fiction', 'Adventure', 'Mystery', 'Romance', 'Science', 'History'])],
        isActive: true
      }
    });

    books.push(book);
  }

  console.log(`✓ Generated ${CONFIG.books} books`);
  return books;
}

async function generateActivities(students: any[], equipment: any[]) {
  console.log('Generating activities...');

  const activities = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - CONFIG.daysOfHistory);

  for (let i = 0; i < CONFIG.activities; i++) {
    const student = getRandomElement(students);
    const activityType = getRandomElement(ACTIVITY_TYPES);
    const activityDate = getRandomDate(startDate, endDate);
    const duration = getRandomInt(15, 180); // 15 minutes to 3 hours
    const startTime = new Date(activityDate);
    startTime.setHours(getRandomInt(8, 17), getRandomInt(0, 59), 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + duration);

    // Determine status based on time
    let status: 'active' | 'completed' | 'expired' = 'completed';
    if (endTime > new Date()) {
      status = Math.random() < 0.2 ? 'active' : 'scheduled';
    } else if (Math.random() < 0.1) {
      status = 'expired';
    }

    const activity = await prisma.activity.create({
      data: {
        studentId: student.id,
        activityType,
        startTime,
        endTime: status === 'active' ? null : endTime,
        status,
        purpose: `Student ${activityType.toLowerCase()} session`,
        notes: faker.lorem.sentence(),
        equipmentId: Math.random() < 0.7 ? getRandomElement(equipment).id : null,
        timeLimitMinutes: duration,
        actualDurationMinutes: status === 'completed' ? duration : null,
        createdBy: 'System'
      }
    });

    activities.push(activity);
  }

  console.log(`✓ Generated ${CONFIG.activities} activities`);
  return activities;
}

async function generateSystemConfig() {
  console.log('Generating system configuration...');

  const configs = [
    {
      key: 'library_name',
      value: 'Sacred Heart of Jesus Catholic School Library',
      description: 'Library name for display purposes',
      isSecret: false,
      category: 'General'
    },
    {
      key: 'library_hours',
      value: '7:30 AM - 5:00 PM',
      description: 'Library operating hours',
      isSecret: false,
      category: 'General'
    },
    {
      key: 'max_session_duration',
      value: '180',
      description: 'Maximum session duration in minutes',
      isSecret: false,
      category: 'Limits'
    },
    {
      key: 'max_daily_sessions',
      value: '3',
      description: 'Maximum sessions per student per day',
      isSecret: false,
      category: 'Limits'
    },
    {
      key: 'google_sheets_enabled',
      value: 'true',
      description: 'Enable Google Sheets integration',
      isSecret: false,
      category: 'Integration'
    },
    {
      key: 'automated_backup',
      value: 'true',
      description: 'Enable automated backups',
      isSecret: false,
      category: 'Backup'
    },
    {
      key: 'notification_email',
      value: 'library@shjs.edu.ph',
      description: 'Library notification email',
      isSecret: false,
      category: 'Notifications'
    }
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: config,
      create: config
    });
  }

  console.log(`✓ Generated ${configs.length} system configurations`);
}

async function generateAutomationJobs() {
  console.log('Generating automation jobs...');

  const jobs = [
    {
      name: 'Daily Backup',
      type: 'BACKUP',
      schedule: '0 2 * * *', // 2:00 AM daily
      description: 'Automated daily database backup',
      isEnabled: true,
      status: 'IDLE'
    },
    {
      name: 'Weekly Report',
      type: 'REPORT',
      schedule: '0 8 * * 1', // 8:00 AM every Monday
      description: 'Generate weekly library usage report',
      isEnabled: true,
      status: 'IDLE'
    },
    {
      name: 'Google Sheets Sync',
      type: 'GOOGLE_SHEETS_SYNC',
      schedule: '0 */6 * * *', // Every 6 hours
      description: 'Sync data with Google Sheets',
      isEnabled: true,
      status: 'IDLE'
    },
    {
      name: 'Session Cleanup',
      type: 'CLEANUP',
      schedule: '0 1 * * *', // 1:00 AM daily
      description: 'Clean up expired sessions',
      isEnabled: true,
      status: 'IDLE'
    },
    {
      name: 'QR Code Generation',
      type: 'QR_GENERATION',
      schedule: '0 3 1 * *', // 3:00 AM on 1st of month
      description: 'Generate QR codes for new students',
      isEnabled: true,
      status: 'IDLE'
    }
  ];

  for (const job of jobs) {
    await prisma.automationJob.upsert({
      where: { name: job.name },
      update: job,
      create: {
        ...job,
        nextRunAt: new Date(Date.now() + getRandomInt(60000, 86400000)) // Random next run within 24 hours
      }
    });
  }

  console.log(`✓ Generated ${jobs.length} automation jobs`);
}

// Main execution
async function main() {
  console.log('🚀 Starting CLMS sample data generation...\n');

  try {
    // Clear existing data (be careful with this in production!)
    console.log('Clearing existing data...');
    await prisma.activity.deleteMany();
    await prisma.automationJob.deleteMany();
    await prisma.systemConfig.deleteMany();
    await prisma.book.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany({ where: { username: { not: 'admin' } } });
    console.log('✓ Cleared existing data\n');

    // Generate data in order
    const { admin, staffUsers } = await generateUsers();
    const students = await generateStudents();
    const equipment = await generateEquipment();
    const books = await generateBooks();
    const activities = await generateActivities(students, equipment);
    await generateSystemConfig();
    await generateAutomationJobs();

    console.log('\n🎉 Sample data generation completed successfully!');
    console.log('\n📊 Generated Summary:');
    console.log(`  👤 Users: ${1 + CONFIG.staffUsers + 1} (1 admin + ${CONFIG.staffUsers} staff + 1 system)`);
    console.log(`  👨‍🎓 Students: ${CONFIG.students}`);
    console.log(`  💻 Equipment: ${equipment.length}`);
    console.log(`  📚 Books: ${CONFIG.books}`);
    console.log(`  📋 Activities: ${CONFIG.activities}`);
    console.log(`  ⚙️  System Config: 7 settings`);
    console.log(`  🤖 Automation Jobs: 5 jobs`);

    console.log('\n🔐 Login Credentials:');
    console.log(`  Admin: admin / admin123`);
    console.log(`  Staff: staff users with password: admin123`);

    console.log('\n⏰ Data covers the last', CONFIG.daysOfHistory, 'days');

  } catch (error) {
    console.error('❌ Error generating sample data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as generateSampleData };