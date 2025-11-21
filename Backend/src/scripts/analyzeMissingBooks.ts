import { prisma } from '../utils/prisma';
import * as fs from 'fs';
import * as path from 'path';

// const prisma = new PrismaClient();

async function analyzeMissingBooks() {
  const projectRoot = process.cwd().endsWith('Backend')
    ? path.resolve(process.cwd(), '..')
    : process.cwd();
  const booksCsv = path.resolve(
    projectRoot,
    'csv',
    'SHJCS Bibliography - BOOK COLLECTIONS.csv',
  );

  if (!fs.existsSync(booksCsv)) {
    console.error(`File not found: ${booksCsv}`);
    return;
  }

  const text = fs.readFileSync(booksCsv, 'utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  console.log(`\n📊 **Missing Books Analysis Report**\n`);
  console.log(`Total rows in CSV: ${lines.length - 1}`);

  const imported = await prisma.books.count();
  const missing = lines.length - 1 - imported;

  console.log(`✅ Successfully imported: ${imported}`);
  console.log(`❌ Failed to import: ${missing}\n`);

  console.log(`**Analyzing failure reasons:**\n`);

  const parseCSVLine = (line: string): string[] => {
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
  };

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const idx = (name: string) =>
    headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const iBarcode = idx('Barcode');
  const iTitle = idx('Title');

  let missingBarcode = 0;
  let missingTitle = 0;
  let duplicateBarcode = 0;
  const seenBarcodes = new Set<string>();

  const failedRows: Array<{
    row: number;
    barcode: string;
    title: string;
    reason: string;
  }> = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r]);
    const barcode = (cols[iBarcode] || '').trim();
    const title = (cols[iTitle] || '').trim();

    if (!barcode) {
      missingBarcode++;
      failedRows.push({
        row: r + 1,
        barcode,
        title,
        reason: 'Missing Barcode',
      });
    } else if (!title) {
      missingTitle++;
      failedRows.push({ row: r + 1, barcode, title, reason: 'Missing Title' });
    } else if (seenBarcodes.has(barcode)) {
      duplicateBarcode++;
      failedRows.push({
        row: r + 1,
        barcode,
        title,
        reason: 'Duplicate Barcode',
      });
    } else {
      seenBarcodes.add(barcode);
    }
  }

  console.log(`Missing Barcode: ${missingBarcode}`);
  console.log(`Missing Title: ${missingTitle}`);
  console.log(`Duplicate Barcodes: ${duplicateBarcode}\n`);

  console.log(`**First 20 Failed Rows:**\n`);
  failedRows.slice(0, 20).forEach(row => {
    console.log(
      `Row ${row.row}: [${row.barcode || 'NO BARCODE'}] "${row.title || 'NO TITLE'}" - ${row.reason}`,
    );
  });

  console.log(`\n**Recommendations:**`);
  console.log(`1. Export failed rows to separate file for manual review`);
  console.log(`2. For duplicate barcodes: Add suffix (e.g., -COPY1, -COPY2)`);
  console.log(`3. For missing data: Review original spreadsheet\n`);

  // Export failed rows
  const outputPath = path.resolve(projectRoot, 'csv', 'FAILED_BOOKS.csv');
  const outputLines = [
    'Row,Barcode,Title,Reason',
    ...failedRows.map(
      row =>
        `${row.row},"${row.barcode}","${row.title.replace(/"/g, '""')}","${row.reason}"`,
    ),
  ];
  fs.writeFileSync(outputPath, outputLines.join('\n'));
  console.log(`✅ Failed rows exported to: ${outputPath}\n`);
}

analyzeMissingBooks()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
