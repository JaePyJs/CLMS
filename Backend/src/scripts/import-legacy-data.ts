import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Adjust path to point to the csv directory in the root of the workspace
// Current file is in Backend/src/scripts/
// Root is ../../../
const CSV_DIR = path.join(process.cwd(), '../../csv');

interface StudentRow {
  'User ID': string | number;
  'First Name': string;
  Surname: string;
  'Grade Level': string;
  Section: string;
}

interface BookRow {
  Barcode: string | number;
  Title: string;
  Author: string;
  Publisher: string;
  Year: string | number;
  ISBN: string | number;
  Edition: string;
  'Physical Description': string;
  'Note Area': string;
  Price: string | number;
  'Call Number': string;
  'Collection Code': string;
}

async function importStudents() {
  console.log('Importing students...');
  const filePath = path.join(CSV_DIR, 'SHJCS SCANLOGS - SHJCS USERS.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    // Try absolute path if relative fails (just in case cwd is different)
    const altPath =
      'c:\\Users\\jmbar\\Desktop\\ALL REPOS\\Pia_REPOS\\CLMS\\csv\\SHJCS SCANLOGS - SHJCS USERS.csv';
    if (fs.existsSync(altPath)) {
      console.log(`Found file at absolute path: ${altPath}`);
      // Use altPath
    } else {
      return;
    }
  }

  // Use the path that works
  const finalPath = fs.existsSync(filePath)
    ? filePath
    : 'c:\\Users\\jmbar\\Desktop\\ALL REPOS\\Pia_REPOS\\CLMS\\csv\\SHJCS SCANLOGS - SHJCS USERS.csv';

  const workbook = XLSX.readFile(finalPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} records.`);

  let count = 0;
  for (const row of data as StudentRow[]) {
    try {
      const studentId = row['User ID']?.toString();
      if (!studentId) {
        continue;
      }

      const firstName = row['First Name']?.trim() || '';
      const lastName = row['Surname']?.trim() || '';
      const gradeLevelStr = row['Grade Level']?.toString().toUpperCase() || '';
      const section = row['Section']?.trim();
      // const designation = row['Designation']?.trim();
      // const sex = row['Sex']?.trim();

      let gradeLevel = 0;
      if (gradeLevelStr.includes('PRE NURSERY')) {
        gradeLevel = -2;
      } else if (gradeLevelStr.includes('NURSERY')) {
        gradeLevel = -1;
      } else if (gradeLevelStr.includes('KINDER')) {
        gradeLevel = 0;
      } else if (gradeLevelStr.includes('GRADE')) {
        const match = gradeLevelStr.match(/\d+/);
        if (match) {
          gradeLevel = parseInt(match[0]);
        }
      }

      await prisma.students.upsert({
        where: { student_id: studentId },
        update: {
          first_name: firstName,
          last_name: lastName,
          grade_level: gradeLevel,
          grade_category: gradeLevelStr,
          section: section,
        },
        create: {
          student_id: studentId,
          first_name: firstName,
          last_name: lastName,
          grade_level: gradeLevel,
          grade_category: gradeLevelStr,
          section: section,
          barcode: studentId,
        },
      });
      count++;
      if (count % 100 === 0) {
        console.log(`Imported ${count} students...`);
      }
    } catch (error) {
      console.error(`Error importing student ${row['User ID']}:`, error);
    }
  }
  console.log(`Finished importing ${count} students.`);
}

async function importBooks() {
  console.log('Importing books...');
  const filePath = path.join(
    CSV_DIR,
    'SHJCS Bibliography - BOOK COLLECTIONS.csv',
  );
  // Check file existence logic similar to students...
  const finalPath = fs.existsSync(filePath)
    ? filePath
    : 'c:\\Users\\jmbar\\Desktop\\ALL REPOS\\Pia_REPOS\\CLMS\\csv\\SHJCS Bibliography - BOOK COLLECTIONS.csv';

  if (!fs.existsSync(finalPath)) {
    console.error(`File not found: ${finalPath}`);
    return;
  }

  const workbook = XLSX.readFile(finalPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} records.`);

  let count = 0;
  for (const row of data as BookRow[]) {
    try {
      const barcode = row['Barcode']?.toString();
      if (!barcode) {
        continue;
      }

      const title = row['Title']?.toString().trim() || 'Unknown Title';
      let author = row['Author']?.toString().trim() || 'Unknown Author';
      if (author.length > 190) {
        author = author.substring(0, 190);
      }

      const publisher = row['Publisher']?.toString().trim();
      const yearStr = row['Year']?.toString();
      const year = yearStr ? parseInt(yearStr.replace(/\D/g, '')) : undefined;
      const isbn = row['ISBN']?.toString();
      const edition = row['Edition']?.toString();
      const pages = row['Physical Description']?.toString();
      const remarks = row['Note Area']?.toString();
      const priceStr = row['Price']?.toString();
      const price = priceStr
        ? parseFloat(priceStr.replace(/[^\d.]/g, ''))
        : undefined;
      const callNumber = row['Call Number']?.toString();
      const collectionCode = row['Collection Code']?.toString();

      await prisma.books.upsert({
        where: { accession_no: barcode },
        update: {
          title,
          author,
          publisher,
          year: isNaN(year as number) ? undefined : year,
          isbn,
          edition,
          pages,
          remarks,
          cost_price: isNaN(price as number) ? undefined : price,
          location: callNumber,
          category: collectionCode,
        },
        create: {
          accession_no: barcode,
          title,
          author,
          publisher,
          year: isNaN(year as number) ? undefined : year,
          isbn,
          edition,
          pages,
          remarks,
          cost_price: isNaN(price as number) ? undefined : price,
          location: callNumber,
          category: collectionCode,
          total_copies: 1,
          available_copies: 1,
        },
      });
      count++;
      if (count % 100 === 0) {
        console.log(`Imported ${count} books...`);
      }
    } catch (error) {
      console.error(`Error importing book ${row['Barcode']}:`, error);
    }
  }
  console.log(`Finished importing ${count} books.`);
}

async function main() {
  await importStudents();
  await importBooks();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
