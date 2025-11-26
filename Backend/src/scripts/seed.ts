import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Initialize Prisma Client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
const CSV_DIR = path.resolve(__dirname, '../../../csv');

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
  Title: string;
  Author: string;
  'Call Number': string;
  Year: string;
  Publisher: string;
  ISBN: string;
  Edition: string;
  'Collection Code': string;
  'Physical Description': string;
  Price: string;
}

async function seedLibrarian() {
  const username = 'librarian';
  const password = 'lib123';

  console.log('Seeding librarian account...');
  const existing = await prisma.users.findUnique({ where: { username } });
  if (!existing) {
    const hash = await bcrypt.hash(password, rounds);
    await prisma.users.create({
      data: {
        username,
        password: hash,
        role: 'LIBRARIAN',
        is_active: true,
        full_name: 'Librarian User',
      },
    });
    console.log('Librarian account created.');
  } else {
    console.log('Librarian account already exists.');
  }
}

async function seedStudents() {
  const filePath = path.join(CSV_DIR, 'SHJCS SCANLOGS - SHJCS USERS.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`Reading students from ${filePath}...`);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json<StudentRow>(sheet);

  console.log(`Found ${data.length} students/personnel. Seeding...`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of data) {
    try {
      const userId = String(row['User ID'] || '').trim();
      const surname = String(row['Surname'] || '').trim();
      const firstName = String(row['First Name'] || '').trim();
      const gradeLevelStr = String(row['Grade Level'] || '').trim();
      const section = String(row['Section'] || '').trim();
      const designation = String(row['Designation'] || '').trim();

      if (!userId) {
        continue;
      }

      let gradeLevel = 0;
      // Handle Personnel
      if (designation.toUpperCase() === 'PERSONNEL') {
        gradeLevel = 0;
      } else {
        // Parse Grade Level for students
        const gradeMatch = gradeLevelStr.match(/(?:GRADE|Grade)\s*(\d+)/i);
        if (gradeMatch) {
          gradeLevel = parseInt(gradeMatch[1], 10);
        } else if (/KINDER/i.test(gradeLevelStr)) {
          gradeLevel = 0;
        } else if (/NURSERY/i.test(gradeLevelStr)) {
          gradeLevel = -1;
        } else if (/PRE\s*NURSERY/i.test(gradeLevelStr)) {
          gradeLevel = -2;
        }
      }

      // User ID is the Barcode
      const barcode = userId;

      await prisma.students.upsert({
        where: { student_id: userId },
        update: {
          first_name: firstName,
          last_name: surname,
          grade_level: gradeLevel,
          grade_category: designation || 'Student',
          section: section,
          barcode: barcode,
        },
        create: {
          student_id: userId,
          first_name: firstName,
          last_name: surname,
          grade_level: gradeLevel,
          grade_category: designation || 'Student',
          section: section,
          barcode: barcode,
        },
      });
      successCount++;
    } catch (error) {
      console.error(`Error seeding student ${row['User ID']}:`, error);
      errorCount++;
    }
  }

  console.log(
    `Students/Personnel seeded: ${successCount}, Errors: ${errorCount}`,
  );
}

async function seedBooks() {
  const filePath = path.join(
    CSV_DIR,
    'SHJCS Bibliography - BOOK COLLECTIONS.csv',
  );
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`Reading books from ${filePath}...`);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json<BookRow>(sheet);

  console.log(`Found ${data.length} books. Seeding...`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of data) {
    try {
      const barcode = String(row['Barcode'] || '').trim();
      const title = String(row['Title'] || '')
        .trim()
        .substring(0, 190);
      const author = String(row['Author'] || '')
        .trim()
        .substring(0, 190);
      const callNumber = String(row['Call Number'] || '')
        .trim()
        .substring(0, 190);
      const yearStr = String(row['Year'] || '').trim();
      const publisher = String(row['Publisher'] || '')
        .trim()
        .substring(0, 190);
      const isbn = String(row['ISBN'] || '')
        .trim()
        .substring(0, 190);
      const edition = String(row['Edition'] || '')
        .trim()
        .substring(0, 190);
      const collectionCode = String(row['Collection Code'] || '')
        .trim()
        .substring(0, 190);
      const physicalDesc = String(row['Physical Description'] || '')
        .trim()
        .substring(0, 190);
      const priceStr = String(row['Price'] || '').trim();

      if (!barcode) {
        continue;
      }

      const finalTitle = title || 'Unknown Title';

      const year = parseInt(yearStr, 10) || undefined;
      const price = parseFloat(priceStr) || undefined;

      await prisma.books.upsert({
        where: { accession_no: barcode },
        update: {
          title: finalTitle,
          author: author || 'Unknown',
          location: callNumber,
          year: year,
          publisher: publisher,
          isbn: isbn,
          edition: edition,
          category: collectionCode,
          pages: physicalDesc,
          cost_price: price,
          total_copies: 1,
          available_copies: 1,
        },
        create: {
          accession_no: barcode,
          title: finalTitle,
          author: author || 'Unknown',
          location: callNumber,
          year: year,
          publisher: publisher,
          isbn: isbn,
          edition: edition,
          category: collectionCode,
          pages: physicalDesc,
          cost_price: price,
          total_copies: 1,
          available_copies: 1,
        },
      });
      successCount++;
    } catch (error) {
      console.error(`Error seeding book ${row['Barcode']}:`, error);
      errorCount++;
    }
  }

  console.log(`Books seeded: ${successCount}, Errors: ${errorCount}`);
}

async function main() {
  try {
    console.log('Starting seed process (Real Data Only)...');
    await seedLibrarian();
    await seedStudents();
    await seedBooks();
    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
