import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import * as bcrypt from 'bcryptjs';

interface StudentRow {
  'User ID': string;
  Surname: string;
  'First Name': string;
  'Grade Level': string;
  Section: string;
  Designation: string;
  Sex: string;
}

interface BookRow {
  Barcode: string;
  'Call Number': string;
  Title: string;
  Author: string;
  Year: string;
  Edition: string;
  ISBN: string;
  Publication: string;
  Publisher: string;
  'Collection Code': string;
  'Physical Description': string;
  'Note Area': string;
  Price: string;
}

// Clear all data from database
async function clearDatabase() {
  logger.info('🗑️  Clearing database...');

  await prisma.$transaction([
    prisma.book_checkouts.deleteMany(),
    prisma.equipment_sessions.deleteMany(),
    prisma.student_activities_sections.deleteMany(),
    prisma.student_activities.deleteMany(),
    prisma.archived_activities_sections.deleteMany(),
    prisma.student_activities_archive.deleteMany(),
    prisma.books.deleteMany(),
    prisma.students.deleteMany(),
    prisma.users.deleteMany(),
  ]);

  logger.info('✅ Database cleared');
}

// Parse CSV file
function parseCSV<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', data => results.push(data))
      .on('end', () => resolve(results))
      .on('error', error => reject(error));
  });
}

// Import students (batch insert)
async function importStudents(): Promise<number> {
  const csvPath = path.join(
    __dirname,
    '../../csv/SHJCS SCANLOGS - SHJCS USERS.csv',
  );
  const rows = await parseCSV<StudentRow>(csvPath);

  const studentRows = rows.filter(
    row => !row['User ID'].toUpperCase().startsWith('PN'),
  );
  logger.info(`Found ${studentRows.length} students`);

  const data = studentRows.map(row => ({
    student_id: row['User ID'].trim(),
    barcode: row['User ID'].trim(),
    first_name: row['First Name']?.trim() || '',
    last_name: row['Surname']?.trim() || '',
    grade_level: parseInt(row['Grade Level']?.trim()) || 0,
    section: row['Section']?.trim() || '',
    gender: row['Sex']?.trim() || '',
    designation: 'Student',
    is_active: true,
  }));

  const result = await prisma.students.createMany({
    data,
    // Note: skipDuplicates not supported in SQLite. If duplicates exist, this will fail.
    // For fresh imports, this is fine. For updates, use upsert logic.
  });
  return result.count;
}

// Import personnel (batch insert)
async function importPersonnel(): Promise<number> {
  const csvPath = path.join(
    __dirname,
    '../../csv/SHJCS SCANLOGS - SHJCS USERS.csv',
  );
  const rows = await parseCSV<StudentRow>(csvPath);

  const personnelRows = rows.filter(row =>
    row['User ID'].toUpperCase().startsWith('PN'),
  );
  logger.info(`Found ${personnelRows.length} personnel`);

  const data = personnelRows.map(row => ({
    student_id: row['User ID'].trim(),
    barcode: row['User ID'].trim(),
    first_name: row['First Name']?.trim() || '',
    last_name: row['Surname']?.trim() || '',
    grade_level: 0,
    section: row['Section']?.trim() || '',
    gender: row['Sex']?.trim() || '',
    designation: 'Personnel',
    is_active: true,
  }));

  const result = await prisma.students.createMany({
    data,
    // Note: skipDuplicates not supported in SQLite
  });
  return result.count;
}

// Import books (batch of 500 at a time for performance)
async function importBooks(): Promise<number> {
  const csvPath = path.join(
    __dirname,
    '../../csv/SHJCS Bibliography - BOOK COLLECTIONS.csv',
  );
  const rows = await parseCSV<BookRow>(csvPath);

  logger.info(`Found ${rows.length} books`);

  const booksData = rows.map(row => {
    let year: number | null = null;
    if (row['Year']) {
      const parsed = parseInt(row['Year'].trim());
      if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) {
        year = parsed;
      }
    }

    let price: number | null = null;
    if (row['Price']) {
      const parsed = parseFloat(row['Price'].trim().replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) {
        price = parsed;
      }
    }

    return {
      barcode: row['Barcode']?.trim() || '',
      accession_no:
        row['Barcode']?.trim() ||
        `ACC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      call_number: row['Call Number']?.trim() || '',
      title: row['Title']?.trim() || 'Untitled',
      author: row['Author']?.trim() || '',
      publisher: row['Publisher']?.trim() || '',
      publication_year: year,
      isbn: row['ISBN']?.trim() || '',
      edition: row['Edition']?.trim() || '',
      collection_code: row['Collection Code']?.trim() || '',
      physical_description: row['Physical Description']?.trim() || '',
      notes: row['Note Area']?.trim() || '',
      price: price,
      status: 'AVAILABLE',
      is_active: true,
    };
  });

  // Batch insert (500 at a time to avoid hitting limits)
  let total = 0;
  const batchSize = 500;
  for (let i = 0; i < booksData.length; i += batchSize) {
    const batch = booksData.slice(i, i + batchSize);
    const result = await prisma.books.createMany({
      data: batch,
      // Note: skipDuplicates not supported in SQLite
    });
    total += result.count;
    console.log(`  Imported ${total}/${booksData.length} books...`);
  }

  return total;
}

// Create default users
async function createDefaultUsers(): Promise<void> {
  const defaultUsers = [
    {
      username: 'admin',
      password: 'admin123',
      role: 'ADMIN',
      email: 'admin@library.local',
    },
    {
      username: 'librarian',
      password: 'librarian123',
      role: 'LIBRARIAN',
      email: 'librarian@library.local',
    },
  ];

  for (const user of defaultUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);

    await prisma.users.create({
      data: {
        username: user.username,
        password: hashedPassword,
        role: user.role,
        email: user.email,
        is_active: true,
      },
    });

    logger.info(`✅ Created user: ${user.username} (${user.role})`);
  }
}

// Main seeding function
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    await clearDatabase();

    console.log('\n👥 Importing students...');
    const studentsCount = await importStudents();
    console.log(`✅ Imported ${studentsCount} students\n`);

    console.log('🧑‍💼 Importing personnel...');
    const personnelCount = await importPersonnel();
    console.log(`✅ Imported ${personnelCount} personnel\n`);

    console.log('📚 Importing books...');
    const booksCount = await importBooks();
    console.log(`✅ Imported ${booksCount} books\n`);

    console.log('🔐 Creating default users...');
    await createDefaultUsers();
    console.log('✅ Default users created\n');

    console.log('✨ Database seeding complete!');
    console.log('\nDefault Credentials:');
    console.log('  Admin     - Username: admin     | Password: admin123');
    console.log('  Librarian - Username: librarian | Password: librarian123\n');
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDatabase };
