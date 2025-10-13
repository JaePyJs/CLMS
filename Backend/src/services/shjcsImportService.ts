import { createReadStream } from 'fs';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import { parse } from 'csv-parse';
import { students_grade_category } from '@prisma/client';

// Import result interface
export interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: string[];
}

// SHJCS Student import data interface
interface SHJCSStudentImportData {
  Names: string; // Format: "1. Last name" or just "Last name"
  'User id': string; // Student ID
  Section: string; // Grade/Class
  '': string; // Barcode column (format: *ID*)
  [key: string]: string; // Allow additional columns
}

// SHJCS Book import data interface
interface SHJCSBookImportData {
  Barcode: string; // Barcode/Accession No
  'Call Number'?: string;
  Title: string;
  Author?: string;
  Year?: string;
  Edition?: string;
  ISBN?: string;
  Publication?: string; // City
  Publisher?: string;
  'Collection Code'?: string;
  'Physical Description'?: string;
  'Note Area'?: string;
  Price?: string;
  [key: string]: string | undefined;
}

// Import service class for SHJCS data
export class SHJCSImportService {
  // Import students from SHJCS PATRONS CSV file
  async importSHJCSStudents(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting SHJCS student import from ${filePath}`);

      const records = await this.parseCsvFile<SHJCSStudentImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (!record.Names || !record.Section) {
            result.errors.push(
              `Missing required fields for student: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Skip if User ID is empty or just asterisks
          if (!record['User id'] || record['User id'].trim() === '' || record['User id'].trim() === '**') {
            result.errors.push(
              `Skipping student with no User ID: ${record.Names}`,
            );
            result.skippedRecords++;
            continue;
          }

          // Parse name - remove number prefix if present
          let nameStr = record.Names.trim();
          // Remove leading number and period (e.g., "1. " or "23. ")
          nameStr = nameStr.replace(/^\d+\.\s*/, '');
          
          // Split name parts (might be "Last, First" or just "Last")
          const nameParts = nameStr.split(',').map(part => part.trim());
          const lastName = nameParts[0] || nameStr;
          const firstName = nameParts[1] || lastName; // Use lastName if no firstName

          if (!lastName) {
            result.errors.push(
              `Invalid name format for student: ${record.Names}`,
            );
            result.errorRecords++;
            continue;
          }

          const student_id = record['User id'].trim();
          
          // Extract barcode from format *ID* or just use the ID
          let barcodeData = record[''] || '';
          if (barcodeData) {
            barcodeData = barcodeData.replace(/\*/g, '').trim();
          }

          // Determine grade category from section name
          let grade_category: students_grade_category = students_grade_category.JUNIOR_HIGH;
          const sectionLower = record.Section.toLowerCase();
          
          // Check if section contains grade indicators
          if (sectionLower.includes('7') || sectionLower.includes('8') || 
              sectionLower.includes('9') || sectionLower.includes('10') ||
              sectionLower.includes('grade 7') || sectionLower.includes('grade 8')) {
            gradeCategory = students_grade_category.JUNIOR_HIGH;
          } else if (sectionLower.includes('11') || sectionLower.includes('12') ||
                     sectionLower.includes('grade 11') || sectionLower.includes('grade 12')) {
            gradeCategory = students_grade_category.SENIOR_HIGH;
          }

          // Determine grade level from section
          let gradeLevel = 'Grade 7'; // Default
          if (sectionLower.includes('7')) gradeLevel = 'Grade 7';
          else if (sectionLower.includes('8')) gradeLevel = 'Grade 8';
          else if (sectionLower.includes('9')) gradeLevel = 'Grade 9';
          else if (sectionLower.includes('10')) gradeLevel = 'Grade 10';
          else if (sectionLower.includes('11')) gradeLevel = 'Grade 11';
          else if (sectionLower.includes('12')) gradeLevel = 'Grade 12';

          // Check if student already exists
          const existingStudent = await prisma.students.findUnique({
            where: { student_id },
          });

          if (existingStudent) {
            logger.info(`Student already exists, skipping: ${student_id}`);
            result.skippedRecords++;
            continue;
          }

          // Create student
          await prisma.students.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(), 
              student_id,
              first_name,
              last_name,
              grade_level,
              grade_category,
              section: record.Section,
              barcode_image: barcodeData || null,
            },
          });

          result.importedRecords++;
          logger.info(`Imported student: ${student_id} - ${first_name} ${last_name}`);
        } catch (error) {
          const errorMessage = `Error importing student ${record['User id']}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`SHJCS student import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import SHJCS students', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Import books from SHJCS Bibliography CSV file
  async importSHJCSBooks(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting SHJCS book import from ${filePath}`);

      const records = await this.parseCsvFile<SHJCSBookImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (!record.Barcode || !record.Barcode.trim() || !record.Title) {
            result.errors.push(
              `Missing required fields for book: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          const accessionNo = record.Barcode.trim();

          // Truncate author if too long (MySQL limit)
          let author = record.Author?.trim() || 'Unknown';
          if (author.length > 500) {
            author = author.substring(0, 497) + '...';
            logger.warn(`Author name truncated for book ${accession_no}`);
          }

          // Check if book already exists
          const existingBook = await prisma.books.findUnique({
            where: { accession_no },
          });

          if (existingBook) {
            logger.info(`Book already exists, skipping: ${accession_no}`);
            result.skippedRecords++;
            continue;
          }

          // Parse year to number
          let year: number | null = null;
          if (record.Year) {
            const parsedYear = parseInt(record.Year.trim(), 10);
            if (!isNaN(parsedYear)) {
              year = parsedYear;
            }
          }

          // Parse price to number
          let cost_price: number | null = null;
          if (record.Price) {
            const cleanPrice = record.Price.replace(/[^0-9.-]/g, '');
            const parsedPrice = parseFloat(cleanPrice);
            if (!isNaN(parsedPrice)) {
              costPrice = parsedPrice;
            }
          }

          // Determine category from Collection Code
          const category = record['Collection Code']?.trim() || 'General';

          // Create book with SHJCS format
          await prisma.books.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(), 
              accession_no,
              isbn: record.ISBN?.trim() || null,
              title: record.Title.trim(),
              author, // Use the truncated author
              publisher: record.Publisher?.trim() || null,
              category,
              subcategory: record['Call Number']?.trim() || null,
              location: record.Publication?.trim() || null, // Using Publication (city) as location
              total_copies: 1,
              available_copies: 1,
              // Additional fields
              edition: record.Edition?.trim() || null,
              volume: null, // Not in SHJCS format
              pages: record['Physical Description']?.trim() || null,
              source_of_fund: null, // Not in SHJCS format
              cost_price,
              year,
              remarks: record['Note Area']?.trim() || null,
            },
          });

          result.importedRecords++;
          logger.info(`Imported book: ${accession_no} - ${record.Title}`);
        } catch (error) {
          const errorMessage = `Error importing book ${record.Barcode}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`SHJCS book import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import SHJCS books', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Parse CSV file
  private async parseCsvFile<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const records: T[] = [];

      createReadStream(filePath)
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true, // Allow varying column counts
          }),
        )
        .on('data', (record: unknown) => {
          records.push(record as T);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }
}

// Create and export singleton instance
export const shjcsImportService = new SHJCSImportService();
export default shjcsImportService;
