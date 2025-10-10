#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const importService_1 = require("@/services/importService");
const barcodeService_1 = require("@/services/barcodeService");
const fs_1 = require("fs");
const path_1 = require("path");
const program = new commander_1.Command();
program
    .name('clms-cli')
    .description('CLMS Command Line Interface')
    .version('1.0.0');
program
    .command('import')
    .description('Import data from CSV files')
    .option('-t, --type <type>', 'Type of data to import (students, books, equipment)', 'students')
    .option('-f, --file <file>', 'Path to CSV file')
    .action(async (options) => {
    try {
        if (!options.file) {
            console.error('Error: File path is required');
            process.exit(1);
        }
        if (!(0, fs_1.existsSync)(options.file)) {
            console.error(`Error: File not found: ${options.file}`);
            process.exit(1);
        }
        console.log(`Importing ${options.type} from ${options.file}...`);
        let result;
        switch (options.type) {
            case 'students':
                result = await importService_1.importService.importStudents(options.file);
                break;
            case 'books':
                result = await importService_1.importService.importBooks(options.file);
                break;
            case 'equipment':
                result = await importService_1.importService.importEquipment(options.file);
                break;
            default:
                console.error(`Error: Unknown import type: ${options.type}`);
                process.exit(1);
        }
        console.log('\nImport Results:');
        console.log(`Total Records: ${result.totalRecords}`);
        console.log(`Imported: ${result.importedRecords}`);
        console.log(`Skipped: ${result.skippedRecords}`);
        console.log(`Errors: ${result.errorRecords}`);
        if (result.errors.length > 0) {
            console.log('\nErrors:');
            result.errors.forEach(error => console.log(`- ${error}`));
        }
        if (result.success) {
            console.log('\nImport completed successfully!');
            process.exit(0);
        }
        else {
            console.log('\nImport completed with errors!');
            process.exit(1);
        }
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
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
            console.error('Error: Either --id or --all is required');
            process.exit(1);
        }
        const barcodeOptions = {
            format: options.format
        };
        if (options.all) {
            console.log(`Generating barcodes for all ${options.type}s...`);
            let result;
            switch (options.type) {
                case 'student':
                    result = await barcodeService_1.barcodeService.generateAllStudentBarcodes(barcodeOptions);
                    break;
                case 'book':
                    result = await barcodeService_1.barcodeService.generateAllBookBarcodes(barcodeOptions);
                    break;
                case 'equipment':
                    result = await barcodeService_1.barcodeService.generateAllEquipmentBarcodes(barcodeOptions);
                    break;
                default:
                    console.error(`Error: Unknown barcode type: ${options.type}`);
                    process.exit(1);
            }
            if (result.success) {
                console.log(`Generated ${result.count} barcodes successfully!`);
                console.log(`Output directory: ${barcodeService_1.barcodeService.getOutputDir()}`);
                process.exit(0);
            }
            else {
                console.error(`Error: ${result.error}`);
                process.exit(1);
            }
        }
        else {
            console.log(`Generating barcode for ${options.type} with ID: ${options.id}`);
            let result;
            switch (options.type) {
                case 'student':
                    result = await barcodeService_1.barcodeService.generateStudentBarcode(options.id, barcodeOptions);
                    break;
                case 'book':
                    result = await barcodeService_1.barcodeService.generateBookBarcode(options.id, barcodeOptions);
                    break;
                case 'equipment':
                    result = await barcodeService_1.barcodeService.generateEquipmentBarcode(options.id, barcodeOptions);
                    break;
                default:
                    console.error(`Error: Unknown barcode type: ${options.type}`);
                    process.exit(1);
            }
            if (result.success) {
                console.log(`Barcode generated successfully!`);
                console.log(`Output file: ${result.barcodePath}`);
                process.exit(0);
            }
            else {
                console.error(`Error: ${result.error}`);
                process.exit(1);
            }
        }
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('template')
    .description('Generate CSV templates for data import')
    .option('-t, --type <type>', 'Type of template to generate (students, books, equipment)', 'students')
    .option('-o, --output <file>', 'Output file path')
    .action(async (options) => {
    try {
        let template;
        let defaultFilename;
        switch (options.type) {
            case 'students':
                template = importService_1.importService.getStudentTemplate();
                defaultFilename = 'students_template.csv';
                break;
            case 'books':
                template = importService_1.importService.getBookTemplate();
                defaultFilename = 'books_template.csv';
                break;
            case 'equipment':
                template = importService_1.importService.getEquipmentTemplate();
                defaultFilename = 'equipment_template.csv';
                break;
            default:
                console.error(`Error: Unknown template type: ${options.type}`);
                process.exit(1);
        }
        const outputPath = options.output || (0, path_1.join)(process.cwd(), defaultFilename);
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        fs.writeFileSync(outputPath, template);
        console.log(`Template generated successfully!`);
        console.log(`Output file: ${outputPath}`);
        process.exit(0);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=index.js.map