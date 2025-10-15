import { createReadStream } from 'fs';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import { parse } from 'csv-parse';
import { students_grade_category, equipment_type, equipment_status } from '@prisma/client';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

// Import result interface
export interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: string[];
}

// Field mapping interface
export interface FieldMapping {
  sourceField: string;
  targetField: string;
  required: boolean;
}

// Preview data interface
export interface PreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  suggestedMappings: FieldMapping[];
  fileType: 'csv' | 'excel';
}

// Enhanced import options
export interface ImportOptions {
  fieldMappings?: FieldMapping[];
  skipHeader?: boolean;
  previewMode?: boolean;
  maxPreviewRows?: number;
}

// Student import data interface (updated to match Google Sheets)
interface StudentImportData {
  name: string; // Format: "Last name, First name MI"
  grade_level: string;
  section: string;
  // Note: CSV may have a 4th blank column for barcode scanning - it will be ignored during import
  [key: string]: string; // Allow additional columns to be ignored
}

// Book import data interface (updated to match Google Sheets)
interface BookImportData {
  accession_no: string; // Accession No.
  isbn?: string;
  title: string;
  author: string;
  edition?: string;
  volume?: string;
  pages?: string;
  sourceOfFund?: string; // Source of Fund
  costPrice?: string; // Cost Price
  publisher?: string;
  year?: string;
  remarks?: string;
}

// Equipment import data interface
interface EquipmentImportData {
  equipment_id: string;
  name: string;
  type: string;
  location: string;
  max_time_minutes: number;
  requiresSupervision?: string;
  description?: string;
}

// Import service class
export class ImportService {
  // Enhanced import students with field mapping support
  async importStudentsWithMapping(filePath: string, fieldMappings: FieldMapping[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting enhanced student import from ${filePath}`);

      const records = await this.parseFile<StudentImportData>(filePath, { fieldMappings });
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (!record.name || !record.grade_level || !record.section) {
            result.errors.push(
              `Missing required fields for student: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Parse name (format: "Last name, First name MI")
          const nameParts = record.name.split(',').map((part) => part.trim());
          if (nameParts.length < 2 || !nameParts[0] || !nameParts[1]) {
            result.errors.push(
              `Invalid name format for student: ${record.name}. Expected: "Last name, First name MI"`,
            );
            result.errorRecords++;
            continue;
          }

          const lastName = nameParts[0];
          const firstNameAndMI = nameParts[1].split(' ');
          const firstName = firstNameAndMI[0] || '';

          // Validate required name parts
          if (!lastName || !firstName) {
            result.errors.push(
              `Invalid name parts for student: ${record.name}`,
            );
            result.errorRecords++;
            continue;
          }

          // Auto-generate student ID from name and grade
          const sanitizedLastName = lastName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          const sanitizedFirstName = firstName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          const gradeNum = record.grade_level.replace(/[^0-9]/g, '');
          const student_id = `${gradeNum}-${sanitizedLastName}-${sanitizedFirstName}`;

          // Determine grade category based on grade level
          let grade_category: students_grade_category;
          const gradeNumber = parseInt(gradeNum, 10);
          if (gradeNumber >= 7 && gradeNumber <= 10) {
            grade_category = students_grade_category.JUNIOR_HIGH;
          } else if (gradeNumber >= 11 && gradeNumber <= 12) {
            grade_category = students_grade_category.SENIOR_HIGH;
          } else {
            result.errors.push(
              `Invalid grade level: ${record.grade_level} for student: ${record.name}`,
            );
            result.errorRecords++;
            continue;
          }

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
            data: {
              id: crypto.randomUUID(),
              updated_at: new Date(),
              student_id,
              first_name: firstName,
              last_name: lastName,
              grade_level: record.grade_level,
              grade_category,
              section: record.section,
            },
          });

          result.importedRecords++;
          logger.info(`Imported student: ${student_id}`);
        } catch (error) {
          const errorMessage = `Error importing student ${record.name}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Enhanced student import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import students with mapping', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Enhanced import books with field mapping support
  async importBooksWithMapping(filePath: string, fieldMappings: FieldMapping[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting enhanced book import from ${filePath}`);

      const records = await this.parseFile<BookImportData>(filePath, { fieldMappings });
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (!record.accession_no || !record.title || !record.author) {
            result.errors.push(
              `Missing required fields for book: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Check if book already exists
          const existingBook = await prisma.books.findUnique({
            where: { accession_no: record.accession_no },
          });

          if (existingBook) {
            logger.info(`Book already exists, skipping: ${record.accession_no}`);
            result.skippedRecords++;
            continue;
          }

          // Parse cost price to number
          let cost_price: number | null = null;
          if (record.costPrice) {
            const parsedCost = parseFloat(
              record.costPrice.replace(/[^0-9.-]/g, ''),
            );
            if (!isNaN(parsedCost)) {
              cost_price = parsedCost;
            }
          }

          // Parse year to number
          let year: number | null = null;
          if (record.year) {
            const parsedYear = parseInt(record.year, 10);
            if (!isNaN(parsedYear)) {
              year = parsedYear;
            }
          }

          // Create book with all fields
          await prisma.books.create({
            data: {
              id: crypto.randomUUID(),
              updated_at: new Date(),
              accession_no: record.accession_no,
              isbn: record.isbn || null,
              title: record.title,
              author: record.author,
              publisher: record.publisher || null,
              category: 'General', // Default category, can be updated later
              subcategory: null,
              location: null,
              total_copies: 1, // Default to 1 copy per accession number
              available_copies: 1,
              // Additional metadata
              edition: record.edition || null,
              volume: record.volume || null,
              pages: record.pages || null,
              source_of_fund: record.sourceOfFund || null,
              cost_price,
              year,
              remarks: record.remarks || null,
            },
          });

          result.importedRecords++;
          logger.info(`Imported book: ${record.accession_no}`);
        } catch (error) {
          const errorMessage = `Error importing book ${record.accession_no}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Enhanced book import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import books with mapping', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Import students from CSV file
  async importStudents(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting student import from ${filePath}`);

      const records = await this.parseCsvFile<StudentImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (!record.name || !record.grade_level || !record.section) {
            result.errors.push(
              `Missing required fields for student: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Parse name (format: "Last name, First name MI")
          const nameParts = record.name.split(',').map((part) => part.trim());
          if (nameParts.length < 2 || !nameParts[0] || !nameParts[1]) {
            result.errors.push(
              `Invalid name format for student: ${record.name}. Expected: "Last name, First name MI"`,
            );
            result.errorRecords++;
            continue;
          }

          const lastName = nameParts[0];
          const firstNameAndMI = nameParts[1].split(' ');
          const firstName = firstNameAndMI[0] || '';

          // Validate required name parts
          if (!lastName || !firstName) {
            result.errors.push(
              `Invalid name parts for student: ${record.name}`,
            );
            result.errorRecords++;
            continue;
          }

          // Auto-generate student ID from name and grade
          const sanitizedLastName = lastName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          const sanitizedFirstName = firstName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          const gradeNum = record.grade_level.replace(/[^0-9]/g, '');
          const student_id = `${gradeNum}-${sanitizedLastName}-${sanitizedFirstName}`;

          // Determine grade category based on grade level
          let grade_category: students_grade_category;
          const gradeNumber = parseInt(gradeNum, 10);
          if (gradeNumber >= 7 && gradeNumber <= 10) {
            gradeCategory = students_grade_category.JUNIOR_HIGH;
          } else if (gradeNumber >= 11 && gradeNumber <= 12) {
            gradeCategory = students_grade_category.SENIOR_HIGH;
          } else {
            result.errors.push(
              `Invalid grade level: ${record.grade_level} for student: ${record.name}`,
            );
            result.errorRecords++;
            continue;
          }

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
              grade_level: record.grade_level,
              grade_category,
              section: record.section,
            },
          });

          result.importedRecords++;
          logger.info(`Imported student: ${student_id}`);
        } catch (error) {
          const errorMessage = `Error importing student ${record.name}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Student import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import students', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Import books from CSV file
  async importBooks(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting book import from ${filePath}`);

      const records = await this.parseCsvFile<BookImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (!record.accession_no || !record.title || !record.author) {
            result.errors.push(
              `Missing required fields for book: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Check if book already exists
          const existingBook = await prisma.books.findUnique({
            where: { accession_no: record.accession_no },
          });

          if (existingBook) {
            logger.info(`Book already exists, skipping: ${record.accession_no}`);
            result.skippedRecords++;
            continue;
          }

          // Parse cost price to number
          let cost_price: number | null = null;
          if (record.cost_price) {
            const parsedCost = parseFloat(
              record.cost_price.replace(/[^0-9.-]/g, ''),
            );
            if (!isNaN(parsedCost)) {
              costPrice = parsedCost;
            }
          }

          // Parse year to number
          let year: number | null = null;
          if (record.year) {
            const parsedYear = parseInt(record.year, 10);
            if (!isNaN(parsedYear)) {
              year = parsedYear;
            }
          }

          // Create book with all fields from Google Sheets
          await prisma.books.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(), 
              accession_no: record.accession_no,
              isbn: record.isbn || null,
              title: record.title,
              author: record.author,
              publisher: record.publisher || null,
              category: 'General', // Default category, can be updated later
              subcategory: null,
              location: null,
              total_copies: 1, // Default to 1 copy per accession number
              available_copies: 1,
              // Additional metadata stored in remarks or new fields
              edition: record.edition || null,
              volume: record.volume || null,
              pages: record.pages || null,
              source_of_fund: record.source_of_fund || null,
              cost_price,
              year,
              remarks: record.remarks || null,
            },
          });

          result.importedRecords++;
          logger.info(`Imported book: ${record.accession_no}`);
        } catch (error) {
          const errorMessage = `Error importing book ${record.accession_no}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Book import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import books', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Import equipment from CSV file
  async importEquipment(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting equipment import from ${filePath}`);

      const records = await this.parseCsvFile<EquipmentImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (
            !record.equipment_id ||
            !record.name ||
            !record.type ||
            !record.location ||
            !record.max_time_minutes
          ) {
            result.errors.push(
              `Missing required fields for equipment: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Validate equipment type
          if (
            !Object.values(equipment_type).includes(record.type as equipment_type)
          ) {
            result.errors.push(
              `Invalid equipment type: ${record.type} for equipment: ${record.equipment_id}`,
            );
            result.errorRecords++;
            continue;
          }

          // Parse requiresSupervision
          const requiresSupervision =
            record.requires_supervision?.toLowerCase() === 'yes' ||
            record.requires_supervision?.toLowerCase() === 'true';

          // Check if equipment already exists
          const existingEquipment = await prisma.equipment.findUnique({
            where: { equipment_id: record.equipment_id },
          });

          if (existingEquipment) {
            logger.info(
              `Equipment already exists, skipping: ${record.equipment_id}`,
            );
            result.skippedRecords++;
            continue;
          }

          // Create equipment
          await prisma.equipment.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(), 
              equipment_id: record.equipment_id,
              name: record.name,
              type: record.type as equipment_type,
              location: record.location,
              max_time_minutes: record.max_time_minutes,
              requires_supervision,
              description: record.description || null,
              status: equipment_status.AVAILABLE,
            },
          });

          result.importedRecords++;
          logger.info(`Imported equipment: ${record.equipment_id}`);
        } catch (error) {
          const errorMessage = `Error importing equipment ${record.equipment_id}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Equipment import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import equipment', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Preview file data (supports both CSV and Excel)
  async previewFile(filePath: string, options: ImportOptions = {}): Promise<PreviewData> {
    try {
      const fileExtension = filePath.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        return this.previewCsvFile(filePath, options);
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        return this.previewExcelFile(filePath, options);
      } else {
        throw new Error('Unsupported file format. Only CSV and Excel files are supported.');
      }
    } catch (error) {
      logger.error('Error previewing file', { error: (error as Error).message, filePath });
      throw error;
    }
  }

  // Preview CSV file
  private async previewCsvFile(filePath: string, options: ImportOptions): Promise<PreviewData> {
    return new Promise((resolve, reject) => {
      const records: string[] = [];
      let headers: string[] = [];

      createReadStream(filePath)
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
          }),
        )
        .on('data', (record: any) => {
          if (headers.length === 0) {
            headers = Object.keys(record);
          }
          records.push(...Object.values(record));
        })
        .on('end', () => {
          const rows = this.chunkArray(records, headers.length);
          const suggestedMappings = this.generateSuggestedMappings(headers, 'students');

          resolve({
            headers,
            rows: rows.slice(0, options.maxPreviewRows || 10),
            totalRows: rows.length,
            suggestedMappings,
            fileType: 'csv'
          });
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  // Preview Excel file
  private async previewExcelFile(filePath: string, options: ImportOptions): Promise<PreviewData> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

    if (data.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = data[0] || [];
    const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));
    const suggestedMappings = this.generateSuggestedMappings(headers, 'students');

    return {
      headers,
      rows: rows.slice(0, options.maxPreviewRows || 10),
      totalRows: rows.length,
      suggestedMappings,
      fileType: 'excel'
    };
  }

  // Parse file with field mapping support
  async parseFile<T>(filePath: string, options: ImportOptions = {}): Promise<T[]> {
    const fileExtension = filePath.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      return this.parseCsvFileWithMapping(filePath, options);
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      return this.parseExcelFile(filePath, options);
    } else {
      throw new Error('Unsupported file format. Only CSV and Excel files are supported.');
    }
  }

  // Parse CSV file with field mapping
  private async parseCsvFileWithMapping<T>(filePath: string, options: ImportOptions): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const records: T[] = [];
      let headers: string[] = [];

      createReadStream(filePath)
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
          }),
        )
        .on('data', (record: any) => {
          if (headers.length === 0) {
            headers = Object.keys(record);
          }

          // Apply field mappings if provided
          if (options.fieldMappings && options.fieldMappings.length > 0) {
            const mappedRecord: any = {};
            for (const mapping of options.fieldMappings) {
              const sourceIndex = headers.findIndex(h =>
                h.toLowerCase().includes(mapping.sourceField.toLowerCase()) ||
                mapping.sourceField.toLowerCase().includes(h.toLowerCase())
              );

              if (sourceIndex !== -1) {
                const sourceHeader = headers[sourceIndex];
                mappedRecord[mapping.targetField] = record[sourceHeader];
              } else if (mapping.required) {
                throw new Error(`Required field "${mapping.sourceField}" not found in file`);
              }
            }
            records.push(mappedRecord);
          } else {
            records.push(record);
          }
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  // Parse Excel file
  private async parseExcelFile<T>(filePath: string, options: ImportOptions): Promise<T[]> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

    if (data.length === 0) {
      return [];
    }

    const headers = data[0] || [];
    const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));

    const records: T[] = [];

    for (const row of rows) {
      const record: any = {};

      if (options.fieldMappings && options.fieldMappings.length > 0) {
        // Apply field mappings
        for (const mapping of options.fieldMappings) {
          const sourceIndex = headers.findIndex(h =>
            h.toLowerCase().includes(mapping.sourceField.toLowerCase()) ||
            mapping.sourceField.toLowerCase().includes(h.toLowerCase())
          );

          if (sourceIndex !== -1) {
            record[mapping.targetField] = row[sourceIndex];
          } else if (mapping.required) {
            throw new Error(`Required field "${mapping.sourceField}" not found in file`);
          }
        }
      } else {
        // Use headers as field names
        headers.forEach((header, index) => {
          record[header] = row[index];
        });
      }

      records.push(record);
    }

    return records;
  }

  // Generate suggested field mappings based on headers
  private generateSuggestedMappings(headers: string[], importType: 'students' | 'books' | 'equipment'): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    if (importType === 'students') {
      const studentFields = ['name', 'grade_level', 'section'];

      for (const field of studentFields) {
        const matchedHeader = headers.find(h =>
          h.toLowerCase().includes(field.toLowerCase()) ||
          field.toLowerCase().includes(h.toLowerCase())
        );

        if (matchedHeader) {
          mappings.push({
            sourceField: matchedHeader,
            targetField: field,
            required: true
          });
        }
      }
    }

    return mappings;
  }

  // Helper method to chunk array into rows
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Parse CSV file (legacy method)
  private async parseCsvFile<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const records: T[] = [];

      createReadStream(filePath)
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
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

  // Get sample CSV templates (updated to match Google Sheets format)
  getStudentTemplate(): string {
    // Note: 4th column is blank for barcode scanning (don't type 'barcode' as header)
    return `name,grade_level,section,
"Doe, John A",Grade 7,7-A,
"Smith, Jane B",Grade 8,8-B,
"Garcia, Maria C",Grade 11,11-STEM,`;
  }

  getBookTemplate(): string {
    return `accession_no,isbn,title,author,edition,volume,pages,source_of_fund,cost_price,publisher,year,remarks
ACC-001,978-0-13-468599-1,Effective Java,Joshua Bloch,3rd Edition,1,416,School Budget,1200.00,Addison-Wesley,2018,Good condition
ACC-002,978-1-4919-0409-0,Design Patterns,Erich Gamma,1st Edition,1,395,Donation,0,Addison-Wesley,1994,Classic book`;
  }

  getEquipmentTemplate(): string {
    return `equipment_id,name,type,location,max_time_minutes,requires_supervision,description
COMP-01,Desktop Computer 1,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
COMP-02,Desktop Computer 2,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
GAME-01,PlayStation 5,GAMING,Gaming Room,30,Yes,Sony PlayStation 5 with controller`;
  }
}

// Create and export singleton instance
export const importService = new ImportService();
export default importService;
