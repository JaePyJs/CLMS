#!/usr/bin/env node

import { Command } from 'commander'
import { logger } from '@/utils/logger'
import { importService } from '@/services/importService'
import { barcodeService } from '@/services/barcodeService'
import { existsSync } from 'fs'
import { join } from 'path'

// Initialize CLI
const program = new Command()

// Set up CLI program
program
  .name('clms-cli')
  .description('CLMS Command Line Interface')
  .version('1.0.0')

// Import command
program
  .command('import')
  .description('Import data from CSV files')
  .option('-t, --type <type>', 'Type of data to import (students, books, equipment)', 'students')
  .option('-f, --file <file>', 'Path to CSV file')
  .action(async (options) => {
    try {
      if (!options.file) {
        console.error('Error: File path is required')
        process.exit(1)
      }

      if (!existsSync(options.file)) {
        console.error(`Error: File not found: ${options.file}`)
        process.exit(1)
      }

      console.log(`Importing ${options.type} from ${options.file}...`)

      let result
      switch (options.type) {
        case 'students':
          result = await importService.importStudents(options.file)
          break
        case 'books':
          result = await importService.importBooks(options.file)
          break
        case 'equipment':
          result = await importService.importEquipment(options.file)
          break
        default:
          console.error(`Error: Unknown import type: ${options.type}`)
          process.exit(1)
      }

      console.log('\nImport Results:')
      console.log(`Total Records: ${result.totalRecords}`)
      console.log(`Imported: ${result.importedRecords}`)
      console.log(`Skipped: ${result.skippedRecords}`)
      console.log(`Errors: ${result.errorRecords}`)

      if (result.errors.length > 0) {
        console.log('\nErrors:')
        result.errors.forEach(error => console.log(`- ${error}`))
      }

      if (result.success) {
        console.log('\nImport completed successfully!')
        process.exit(0)
      } else {
        console.log('\nImport completed with errors!')
        process.exit(1)
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

// Barcode command
program
  .command('barcode')
  .description('Generate barcodes')
  .option('-t, --type <type>', 'Type of barcode to generate (student, book, equipment)', 'student')
  .option('-i, --id <id>', 'ID of the entity')
  .option('-a, --all', 'Generate barcodes for all entities')
  .option('-f, --format <format>', 'Barcode format (png, svg, jpg)', 'png')
  .action(async (options) => {
    try {
      if (!options.all && !options.id) {
        console.error('Error: Either --id or --all is required')
        process.exit(1)
      }

      const barcodeOptions = {
        format: options.format
      }

      if (options.all) {
        console.log(`Generating barcodes for all ${options.type}s...`)

        let result
        switch (options.type) {
          case 'student':
            result = await barcodeService.generateAllStudentBarcodes(barcodeOptions)
            break
          case 'book':
            result = await barcodeService.generateAllBookBarcodes(barcodeOptions)
            break
          case 'equipment':
            result = await barcodeService.generateAllEquipmentBarcodes(barcodeOptions)
            break
          default:
            console.error(`Error: Unknown barcode type: ${options.type}`)
            process.exit(1)
        }

        if (result.success) {
          console.log(`Generated ${result.count} barcodes successfully!`)
          console.log(`Output directory: ${barcodeService.getOutputDir()}`)
          process.exit(0)
        } else {
          console.error(`Error: ${result.error}`)
          process.exit(1)
        }
      } else {
        console.log(`Generating barcode for ${options.type} with ID: ${options.id}`)

        let result
        switch (options.type) {
          case 'student':
            result = await barcodeService.generateStudentBarcode(options.id, barcodeOptions)
            break
          case 'book':
            result = await barcodeService.generateBookBarcode(options.id, barcodeOptions)
            break
          case 'equipment':
            result = await barcodeService.generateEquipmentBarcode(options.id, barcodeOptions)
            break
          default:
            console.error(`Error: Unknown barcode type: ${options.type}`)
            process.exit(1)
        }

        if (result.success) {
          console.log(`Barcode generated successfully!`)
          console.log(`Output file: ${result.barcodePath}`)
          process.exit(0)
        } else {
          console.error(`Error: ${result.error}`)
          process.exit(1)
        }
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

// Template command
program
  .command('template')
  .description('Generate CSV templates for data import')
  .option('-t, --type <type>', 'Type of template to generate (students, books, equipment)', 'students')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      let template
      let defaultFilename

      switch (options.type) {
        case 'students':
          template = importService.getStudentTemplate()
          defaultFilename = 'students_template.csv'
          break
        case 'books':
          template = importService.getBookTemplate()
          defaultFilename = 'books_template.csv'
          break
        case 'equipment':
          template = importService.getEquipmentTemplate()
          defaultFilename = 'equipment_template.csv'
          break
        default:
          console.error(`Error: Unknown template type: ${options.type}`)
          process.exit(1)
      }

      const outputPath = options.output || join(process.cwd(), defaultFilename)

      // Write template to file
      const fs = await import('fs')
      fs.writeFileSync(outputPath, template)

      console.log(`Template generated successfully!`)
      console.log(`Output file: ${outputPath}`)
      process.exit(0)
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()