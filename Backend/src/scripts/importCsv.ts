import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), 'Backend', '.env'),
  override: true,
});

// Force correct URL if it's still wrong (double safety)
if (!process.env.DATABASE_URL?.includes('3308')) {
  console.log('Forcing DATABASE_URL to port 3308');
  process.env.DATABASE_URL =
    'mysql://clms_user:clms_password@localhost:3308/clms_database';
}
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function clearDatabase() {
  // Delete in order to avoid foreign key constraints
  await prisma.book_checkouts.deleteMany({});
  await prisma.student_activities_sections.deleteMany({});
  await prisma.student_activities.deleteMany({});
  await prisma.printing_jobs.deleteMany({});
  await prisma.equipment_sessions.deleteMany({});
  await prisma.books.deleteMany({});
  await prisma.students.deleteMany({});
  // Keep users (librarians/admins) and settings/policies if possible, or clear them too if "all mockups" means everything.
  // Usually we want to keep the admin user to log in.
  // await prisma.users.deleteMany({});
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function normalizeGradeLevel(v: string): number {
  const s = String(v).toUpperCase().trim();
  const m: Record<string, number> = {
    'PRE NURSERY': 0,
    NURSERY: 0,
    KINDER: 0,
    'GRADE 1': 1,
    'GRADE 2': 2,
    'GRADE 3': 3,
    'GRADE 4': 4,
    'GRADE 5': 5,
    'GRADE 6': 6,
    'GRADE 7': 7,
    'GRADE 8': 8,
    'GRADE 9': 9,
    'GRADE 10': 10,
    'GRADE 11': 11,
    'GRADE 12': 12,
    '2025-2026': 0,
  };
  return m[s] ?? 0;
}

async function importStudents(csvPath: string) {
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    return { imported: 0, errors: 1 };
  }
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) {
    return { imported: 0, errors: 0 };
  }
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const idx = (name: string) =>
    headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const iUserId = idx('User ID');
  const iSurname = idx('Surname');
  const iFirst = idx('First Name');
  const iGrade = idx('Grade Level');
  const iSection = idx('Section');
  const iDesignation = idx('Designation');
  const result = { imported: 0, errors: 0 };
  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r]);
    const userId = (cols[iUserId] || '').trim();
    const lastName = (cols[iSurname] || '').trim();
    const firstName = (cols[iFirst] || '').trim();
    const grade = (cols[iGrade] || '').trim();
    const section = (cols[iSection] || '').trim();
    const designation = (cols[iDesignation] || '').trim();
    if (!userId || !firstName || !lastName) {
      result.errors++;
      continue;
    }
    const barcode = userId;
    const data = {
      student_id: userId,
      first_name: firstName,
      last_name: lastName,
      grade_level: normalizeGradeLevel(grade),
      section: section || null,
      grade_category: designation ? designation.toUpperCase() : null,
      email: null as string | null,
      barcode,
      is_active: true,
    };
    try {
      const existing = await prisma.students.findUnique({
        where: { student_id: data.student_id },
      });
      if (existing) {
        // await prisma.students.update({
        //   where: { id: existing.id },
        //   data,
        // });
        // console.log(`Skipping existing student: ${data.student_id}`);
      } else {
        await prisma.students.create({ data });
        result.imported++;
      }
    } catch (e) {
      result.errors++;
      console.error('Student row error:', (e as Error).message);
    }
  }
  return result;
}

async function importBooks(csvPath: string) {
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    return { imported: 0, errors: 1 };
  }
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) {
    return { imported: 0, errors: 0 };
  }
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const idx = (name: string) =>
    headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const iBarcode = idx('Barcode');
  const iTitle = idx('Title');
  const iAuthor = idx('Author');
  const iYear = idx('Year');
  const iISBN = idx('ISBN');
  const iPublisher = idx('Publisher');
  const iCollection = idx('Collection Code');
  const result = { imported: 0, errors: 0, flagged: 0 };

  // Helper function to safely truncate strings
  const truncate = (str: string, maxLength: number): string => {
    return str.length > maxLength ? str.substring(0, maxLength) : str;
  };

  // Counter for generating temporary barcodes
  let tempBarcodeCounter = 1;

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r]);
    let accession_no = truncate((cols[iBarcode] || '').trim(), 255);
    let title = truncate((cols[iTitle] || '').trim(), 500);
    let author = truncate((cols[iAuthor] || '').trim(), 255);
    const yearStr = (cols[iYear] || '').trim();
    const isbn = truncate((cols[iISBN] || '').trim(), 50);
    const publisher = truncate((cols[iPublisher] || '').trim(), 255);
    let category = truncate((cols[iCollection] || '').trim(), 100);

    const issues: string[] = [];
    let needsReview = false;

    // Generate temporary barcode if missing
    if (!accession_no) {
      const timestamp = Date.now();
      accession_no = `TEMP-${timestamp}-${tempBarcodeCounter++}`;
      issues.push('Missing barcode - generated temporary ID');
      needsReview = true;
    }

    // Handle missing title
    if (!title) {
      title = `Unknown Title (Row ${r + 1})`;
      issues.push('Missing title');
      needsReview = true;
    }

    // Apply smart defaults and track issues
    if (!author) {
      author = 'Unknown Author';
      issues.push('Missing author');
      needsReview = true;
    }
    if (!category) {
      category = 'Needs Classification';
      issues.push('Missing category');
      needsReview = true;
    }

    // Track other potential issues
    if (!isbn) {
      issues.push('Missing ISBN');
    }
    if (!publisher) {
      issues.push('Missing publisher');
    }

    const importNotes =
      issues.length > 0 ? `Import Issues: ${issues.join('; ')}` : null;

    const year = yearStr ? parseInt(yearStr) : null;
    const data = {
      accession_no,
      title,
      author,
      isbn: isbn || null,
      publisher: publisher || null,
      category,
      subcategory: null as string | null,
      location: null as string | null,
      available_copies: 1,
      total_copies: 1,
      cost_price: null as number | null,
      edition: null as string | null,
      pages: null as string | null,
      remarks: null as string | null,
      source_of_fund: null as string | null,
      volume: null as string | null,
      year,
      is_active: true,
      needs_review: needsReview,
      import_notes: importNotes,
    };

    try {
      const existing = await prisma.books.findUnique({
        where: { accession_no },
      });
      if (existing) {
        // await prisma.books.update({
        //   where: { id: existing.id },
        //   data,
        // });
        // console.log(`Skipping existing book: ${accession_no}`);
      } else {
        await prisma.books.create({ data });
        result.imported++;
      }
      if (needsReview) {
        result.flagged++;
      }
    } catch (e) {
      result.errors++;
      console.error(`Book row error (Row ${r + 1}):`, (e as Error).message);
    }
  }
  return result;
}

async function main() {
  // Clear database as requested
  console.log('Clearing existing data...');
  await clearDatabase();
  console.log('Database cleared.');

  console.log('Starting import...');

  const root = path.resolve(process.cwd());
  // Check if we are in Backend directory, if so go up one level
  const projectRoot = root.endsWith('Backend')
    ? path.resolve(root, '..')
    : root;

  const studentsCsv = path.resolve(
    projectRoot,
    'csv',
    'SHJCS SCANLOGS - SHJCS USERS.csv',
  );
  const booksCsv = path.resolve(
    projectRoot,
    'csv',
    'SHJCS Bibliography - BOOK COLLECTIONS.csv',
  );

  console.log('Importing students from', studentsCsv);
  const s = await importStudents(studentsCsv);
  console.log('Students:', s);

  console.log('Importing books from', booksCsv);
  const b = await importBooks(booksCsv);
  console.log('Books:', b);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
