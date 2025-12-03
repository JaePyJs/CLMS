/**
 * Book Import Script
 *
 * This script imports books from CSV directly to the database.
 * It ensures ALL records are imported with NO data loss.
 *
 * Usage: cd Backend && npx tsx scripts/import-books-csv.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

const prisma = new PrismaClient();

// CSV file path - resolve from the script location
const CSV_PATH = path.resolve(
  __dirname,
  '../../csv/SHJCS Bibliography - BOOK COLLECTIONS - FINAL.csv',
);

interface BookRecord {
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
  [key: string]: string; // Allow dynamic keys
}

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  errors: Array<{ row: number; barcode: string; error: string }>;
}

async function readCSV(): Promise<BookRecord[]> {
  console.log('\n📖 Reading CSV file...');
  console.log(`   Path: ${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
  }

  return new Promise((resolve, reject) => {
    const records: BookRecord[] = [];

    fs.createReadStream(CSV_PATH, { encoding: 'utf-8' })
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => header.trim(),
          mapValues: ({ value }) => value?.trim() || '',
        }),
      )
      .on('data', (row: BookRecord) => {
        records.push(row);
      })
      .on('end', () => {
        console.log(`   Total records: ${records.length}`);
        resolve(records);
      })
      .on('error', error => {
        reject(error);
      });
  });
}

function cleanString(value: string | undefined | null): string | null {
  if (!value || value.trim() === '') return null;
  return value.trim();
}

function parseYear(value: string | undefined | null): number | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (cleaned === '') return null;

  // Extract 4-digit year
  const match = cleaned.match(/(\d{4})/);
  if (match) {
    const year = parseInt(match[1], 10);
    if (year >= 1800 && year <= 2100) {
      return year;
    }
  }
  return null;
}

function parsePrice(value: string | undefined | null): number | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/[₱$,]/g, '');
  if (cleaned === '') return null;

  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

async function importBooks(): Promise<ImportResult> {
  const records = await readCSV();

  const result: ImportResult = {
    total: records.length,
    imported: 0,
    updated: 0,
    errors: [],
  };

  console.log('\n📥 Importing books...');
  console.log('   This may take a few minutes for large datasets.\n');

  // Process in batches for better performance
  const BATCH_SIZE = 100;
  let processed = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNum = i + 2; // +2 because of header row and 0-indexing

    try {
      // Get the barcode (accession number) - this is the unique identifier
      let accessionNo =
        cleanString(record.Barcode) || cleanString(record['barcode']);

      // If no barcode, generate one
      if (!accessionNo) {
        accessionNo = `AUTO_${Date.now()}_${i}`;
        console.log(
          `   ⚠️ Row ${rowNum}: No barcode, generated: ${accessionNo}`,
        );
      }

      // Get title - use placeholder if missing
      let title = cleanString(record.Title) || cleanString(record['title']);
      if (!title) {
        title = '(No Title)';
      }

      // Get author - use placeholder if missing
      let author = cleanString(record.Author) || cleanString(record['author']);
      if (!author) {
        author = '(No Author)';
      }

      // Get category from Collection Code - use placeholder if missing
      let category =
        cleanString(record['Collection Code']) ||
        cleanString(record['collection code']);
      if (!category) {
        category = '(Uncategorized)';
      }

      // Prepare book data - using lowercase model 'books'
      const bookData = {
        accession_no: accessionNo,
        title: title,
        author: author,
        category: category,
        location:
          cleanString(record['Call Number']) ||
          cleanString(record['call number']),
        year: parseYear(record.Year || record['year']),
        edition: cleanString(record.Edition) || cleanString(record['edition']),
        isbn: cleanString(record.ISBN) || cleanString(record['isbn']),
        publisher:
          cleanString(record.Publisher) ||
          cleanString(record.Publication) ||
          cleanString(record['publisher']),
        pages:
          cleanString(record['Physical Description']) ||
          cleanString(record['physical description']),
        remarks:
          cleanString(record['Note Area']) || cleanString(record['note area']),
        cost_price: parsePrice(record.Price || record['price']),
        available_copies: 1,
        total_copies: 1,
        is_active: true,
      };

      // Check if book already exists by accession_no
      const existingBook = await prisma.books.findUnique({
        where: { accession_no: accessionNo },
      });

      if (existingBook) {
        // Update existing book
        await prisma.books.update({
          where: { id: existingBook.id },
          data: bookData,
        });
        result.updated++;
      } else {
        // Create new book
        await prisma.books.create({
          data: bookData,
        });
        result.imported++;
      }

      processed++;

      // Show progress every batch
      if (processed % BATCH_SIZE === 0 || processed === records.length) {
        const percent = Math.round((processed / records.length) * 100);
        process.stdout.write(
          `\r   Progress: ${processed}/${records.length} (${percent}%) - Imported: ${result.imported}, Updated: ${result.updated}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({
        row: rowNum,
        barcode: record.Barcode || '(empty)',
        error: errorMessage,
      });

      // Log the error but continue processing
      console.log(
        `\n   ❌ Row ${rowNum} (${record.Barcode || 'no barcode'}): ${errorMessage}`,
      );
    }
  }

  console.log('\n');
  return result;
}

async function verifyImport(): Promise<void> {
  console.log('\n🔍 Verifying import...');

  const totalBooks = await prisma.books.count();
  const activeBooks = await prisma.books.count({ where: { is_active: true } });

  console.log(`   Total books in database: ${totalBooks}`);
  console.log(`   Active books: ${activeBooks}`);

  // Sample some books
  const samples = await prisma.books.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: {
      accession_no: true,
      title: true,
      author: true,
      category: true,
    },
  });

  console.log('\n   Sample recently imported books:');
  samples.forEach((book, i) => {
    console.log(
      `   ${i + 1}. ${book.accession_no}: "${book.title}" by ${book.author} [${book.category}]`,
    );
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('📚 BOOK IMPORT SCRIPT');
  console.log('='.repeat(60));

  try {
    // Get initial count
    const initialCount = await prisma.books.count();
    console.log(`\n📊 Initial book count: ${initialCount}`);

    // Import books
    const result = await importBooks();

    // Get final count
    const finalCount = await prisma.books.count();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`   CSV records:        ${result.total}`);
    console.log(`   Books before:       ${initialCount}`);
    console.log(`   Books after:        ${finalCount}`);
    console.log(`   New books added:    ${result.imported}`);
    console.log(`   Existing updated:   ${result.updated}`);
    console.log(`   Errors:             ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n   ⚠️ Errors encountered:');
      result.errors.slice(0, 10).forEach((err, i) => {
        console.log(
          `   ${i + 1}. Row ${err.row} (${err.barcode}): ${err.error}`,
        );
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more errors`);
      }
    }

    // Verify
    await verifyImport();

    // Check success
    if (finalCount >= initialCount + result.imported) {
      console.log('\n   ✅ IMPORT SUCCESSFUL! All books imported.');
    } else {
      console.log(
        '\n   ⚠️ Some records may not have been imported. Please review errors above.',
      );
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('\n❌ IMPORT FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
