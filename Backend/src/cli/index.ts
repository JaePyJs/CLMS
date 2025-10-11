#!/usr/bin/env node

import { Command } from 'commander';
import { logger } from '@/utils/logger';
import { importService } from '@/services/importService';
import { barcodeService } from '@/services/barcodeService';
import { existsSync } from 'fs';
import { join } from 'path';

// Initialize CLI
const program = new Command();

// Set up CLI program
program
  .name('clms-cli')
  .description('CLMS Command Line Interface')
  .version('1.0.0');

// Import command
program
  .command('import')
  .description('Import data from CSV files')
  .option(
    '-t, --type <type>',
    'Type of data to import (students, books, equipment)',
    'students',
  )
  .option('-f, --file <file>', 'Path to CSV file')
  .action(async options => {
    try {
      if (!options.file) {
        logger.error('File path is required');
        process.exit(1);
      }

      if (!existsSync(options.file)) {
        logger.error(`File not found: ${options.file}`);
        process.exit(1);
      }

      logger.info(`Importing ${options.type} from ${options.file}...`);

      let result;
      switch (options.type) {
        case 'students':
          result = await importService.importStudents(options.file);
          break;
        case 'books':
          result = await importService.importBooks(options.file);
          break;
        case 'equipment':
          result = await importService.importEquipment(options.file);
          break;
        default:
          logger.error(`Unknown import type: ${options.type}`);
          process.exit(1);
      }

      logger.info('\nImport Results:');
      logger.info(`Total Records: ${result.totalRecords}`);
      logger.info(`Imported: ${result.importedRecords}`);
      logger.info(`Skipped: ${result.skippedRecords}`);
      logger.info(`Errors: ${result.errorRecords}`);

      if (result.errors.length > 0) {
        logger.info('\nErrors:');
        result.errors.forEach(error => logger.info(`- ${error}`));
      }

      if (result.success) {
        logger.info('\nImport completed successfully!');
        process.exit(0);
      } else {
        logger.warn('\nImport completed with errors!');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Barcode command
program
  .command('barcode')
  .description('Generate barcodes')
  .option(
    '-t, --type <type>',
    'Type of barcode to generate (student, book, equipment)',
    'student',
  )
  .option('-i, --id <id>', 'ID of the entity')
  .option('-a, --all', 'Generate barcodes for all entities')
  .option('-f, --format <format>', 'Barcode format (png, svg, jpg)', 'png')
  .action(async options => {
    try {
      if (!options.all && !options.id) {
        logger.error('Either --id or --all is required');
        process.exit(1);
      }

      const barcodeOptions = {
        format: options.format,
      };

      if (options.all) {
        logger.info(`Generating barcodes for all ${options.type}s...`);

        let result;
        switch (options.type) {
          case 'student':
            result =
              await barcodeService.generateAllStudentBarcodes(barcodeOptions);
            break;
          case 'book':
            result =
              await barcodeService.generateAllBookBarcodes(barcodeOptions);
            break;
          case 'equipment':
            result =
              await barcodeService.generateAllEquipmentBarcodes(barcodeOptions);
            break;
          default:
            logger.error(`Unknown barcode type: ${options.type}`);
            process.exit(1);
        }

        if (result.success) {
          logger.info(`Generated ${result.count} barcodes successfully!`);
          logger.info(`Output directory: ${barcodeService.getOutputDir()}`);
          process.exit(0);
        } else {
          logger.error(`Error: ${result.error}`);
          process.exit(1);
        }
      } else {
        logger.info(
          `Generating barcode for ${options.type} with ID: ${options.id}`,
        );

        let result;
        switch (options.type) {
          case 'student':
            result = await barcodeService.generateStudentBarcode(
              options.id,
              barcodeOptions,
            );
            break;
          case 'book':
            result = await barcodeService.generateBookBarcode(
              options.id,
              barcodeOptions,
            );
            break;
          case 'equipment':
            result = await barcodeService.generateEquipmentBarcode(
              options.id,
              barcodeOptions,
            );
            break;
          default:
            logger.error(`Unknown barcode type: ${options.type}`);
            process.exit(1);
        }

        if (result.success) {
          logger.info(`Barcode generated successfully!`);
          logger.info(`Output file: ${result.barcodePath}`);
          process.exit(0);
        } else {
          logger.error(`Error: ${result.error}`);
          process.exit(1);
        }
      }
    } catch (error) {
      logger.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Template command
program
  .command('template')
  .description('Generate CSV templates for data import')
  .option(
    '-t, --type <type>',
    'Type of template to generate (students, books, equipment)',
    'students',
  )
  .option('-o, --output <file>', 'Output file path')
  .action(async options => {
    try {
      let template;
      let defaultFilename;

      switch (options.type) {
        case 'students':
          template = importService.getStudentTemplate();
          defaultFilename = 'students_template.csv';
          break;
        case 'books':
          template = importService.getBookTemplate();
          defaultFilename = 'books_template.csv';
          break;
        case 'equipment':
          template = importService.getEquipmentTemplate();
          defaultFilename = 'equipment_template.csv';
          break;
        default:
          logger.error(`Unknown template type: ${options.type}`);
          process.exit(1);
      }

      const outputPath = options.output || join(process.cwd(), defaultFilename);

      // Write template to file
      const fs = await import('fs');
      fs.writeFileSync(outputPath, template);

      logger.info(`Template generated successfully!`);
      logger.info(`Output file: ${outputPath}`);
      process.exit(0);
    } catch (error) {
      logger.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
