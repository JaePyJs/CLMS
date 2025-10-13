"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importService = exports.ImportService = void 0;
const fs_1 = require("fs");
const logger_1 = require("@/utils/logger");
const prisma_1 = require("@/utils/prisma");
const csv_parse_1 = require("csv-parse");
const client_1 = require("@prisma/client");
class ImportService {
    async importStudents(filePath) {
        const result = {
            success: true,
            totalRecords: 0,
            importedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
        };
        try {
            logger_1.logger.info(`Starting student import from ${filePath}`);
            const records = await this.parseCsvFile(filePath);
            result.totalRecords = records.length;
            for (const record of records) {
                try {
                    if (!record.name || !record.grade_level || !record.section) {
                        result.errors.push(`Missing required fields for student: ${JSON.stringify(record)}`);
                        result.errorRecords++;
                        continue;
                    }
                    const nameParts = record.name.split(',').map((part) => part.trim());
                    if (nameParts.length < 2 || !nameParts[0] || !nameParts[1]) {
                        result.errors.push(`Invalid name format for student: ${record.name}. Expected: "Last name, First name MI"`);
                        result.errorRecords++;
                        continue;
                    }
                    const lastName = nameParts[0];
                    const firstNameAndMI = nameParts[1].split(' ');
                    const firstName = firstNameAndMI[0] || '';
                    if (!lastName || !firstName) {
                        result.errors.push(`Invalid name parts for student: ${record.name}`);
                        result.errorRecords++;
                        continue;
                    }
                    const sanitizedLastName = lastName
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '');
                    const sanitizedFirstName = firstName
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '');
                    const gradeNum = record.grade_level.replace(/[^0-9]/g, '');
                    const student_id = `${gradeNum}-${sanitizedLastName}-${sanitizedFirstName}`;
                    let grade_category;
                    const gradeNumber = parseInt(gradeNum, 10);
                    if (gradeNumber >= 7 && gradeNumber <= 10) {
                        gradeCategory = client_1.students_grade_category.JUNIOR_HIGH;
                    }
                    else if (gradeNumber >= 11 && gradeNumber <= 12) {
                        gradeCategory = client_1.students_grade_category.SENIOR_HIGH;
                    }
                    else {
                        result.errors.push(`Invalid grade level: ${record.grade_level} for student: ${record.name}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingStudent = await prisma_1.prisma.students.findUnique({
                        where: { student_id },
                    });
                    if (existingStudent) {
                        logger_1.logger.info(`Student already exists, skipping: ${student_id}`);
                        result.skippedRecords++;
                        continue;
                    }
                    await prisma_1.prisma.students.create({
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
                    logger_1.logger.info(`Imported student: ${student_id}`);
                }
                catch (error) {
                    const errorMessage = `Error importing student ${record.name}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            logger_1.logger.info(`Student import completed`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import students', {
                error: error.message,
            });
            result.success = false;
            result.errors.push(error.message);
            return result;
        }
    }
    async importBooks(filePath) {
        const result = {
            success: true,
            totalRecords: 0,
            importedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
        };
        try {
            logger_1.logger.info(`Starting book import from ${filePath}`);
            const records = await this.parseCsvFile(filePath);
            result.totalRecords = records.length;
            for (const record of records) {
                try {
                    if (!record.accession_no || !record.title || !record.author) {
                        result.errors.push(`Missing required fields for book: ${JSON.stringify(record)}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingBook = await prisma_1.prisma.books.findUnique({
                        where: { accession_no: record.accession_no },
                    });
                    if (existingBook) {
                        logger_1.logger.info(`Book already exists, skipping: ${record.accession_no}`);
                        result.skippedRecords++;
                        continue;
                    }
                    let cost_price = null;
                    if (record.cost_price) {
                        const parsedCost = parseFloat(record.cost_price.replace(/[^0-9.-]/g, ''));
                        if (!isNaN(parsedCost)) {
                            costPrice = parsedCost;
                        }
                    }
                    let year = null;
                    if (record.year) {
                        const parsedYear = parseInt(record.year, 10);
                        if (!isNaN(parsedYear)) {
                            year = parsedYear;
                        }
                    }
                    await prisma_1.prisma.books.create({
                        data: { id: crypto.randomUUID(), updated_at: new Date(),
                            accession_no: record.accession_no,
                            isbn: record.isbn || null,
                            title: record.title,
                            author: record.author,
                            publisher: record.publisher || null,
                            category: 'General',
                            subcategory: null,
                            location: null,
                            total_copies: 1,
                            available_copies: 1,
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
                    logger_1.logger.info(`Imported book: ${record.accession_no}`);
                }
                catch (error) {
                    const errorMessage = `Error importing book ${record.accession_no}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            logger_1.logger.info(`Book import completed`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import books', {
                error: error.message,
            });
            result.success = false;
            result.errors.push(error.message);
            return result;
        }
    }
    async importEquipment(filePath) {
        const result = {
            success: true,
            totalRecords: 0,
            importedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
        };
        try {
            logger_1.logger.info(`Starting equipment import from ${filePath}`);
            const records = await this.parseCsvFile(filePath);
            result.totalRecords = records.length;
            for (const record of records) {
                try {
                    if (!record.equipment_id ||
                        !record.name ||
                        !record.type ||
                        !record.location ||
                        !record.max_time_minutes) {
                        result.errors.push(`Missing required fields for equipment: ${JSON.stringify(record)}`);
                        result.errorRecords++;
                        continue;
                    }
                    if (!Object.values(client_1.equipment_type).includes(record.type)) {
                        result.errors.push(`Invalid equipment type: ${record.type} for equipment: ${record.equipment_id}`);
                        result.errorRecords++;
                        continue;
                    }
                    const requiresSupervision = record.requires_supervision?.toLowerCase() === 'yes' ||
                        record.requires_supervision?.toLowerCase() === 'true';
                    const existingEquipment = await prisma_1.prisma.equipment.findUnique({
                        where: { equipment_id: record.equipment_id },
                    });
                    if (existingEquipment) {
                        logger_1.logger.info(`Equipment already exists, skipping: ${record.equipment_id}`);
                        result.skippedRecords++;
                        continue;
                    }
                    await prisma_1.prisma.equipment.create({
                        data: { id: crypto.randomUUID(), updated_at: new Date(),
                            equipment_id: record.equipment_id,
                            name: record.name,
                            type: record.type,
                            location: record.location,
                            max_time_minutes: record.max_time_minutes,
                            requires_supervision,
                            description: record.description || null,
                            status: client_1.equipment_status.AVAILABLE, },
                    });
                    result.importedRecords++;
                    logger_1.logger.info(`Imported equipment: ${record.equipment_id}`);
                }
                catch (error) {
                    const errorMessage = `Error importing equipment ${record.equipment_id}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            logger_1.logger.info(`Equipment import completed`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import equipment', {
                error: error.message,
            });
            result.success = false;
            result.errors.push(error.message);
            return result;
        }
    }
    async parseCsvFile(filePath) {
        return new Promise((resolve, reject) => {
            const records = [];
            (0, fs_1.createReadStream)(filePath)
                .pipe((0, csv_parse_1.parse)({
                columns: true,
                skip_empty_lines: true,
                trim: true,
            }))
                .on('data', (record) => {
                records.push(record);
            })
                .on('end', () => {
                resolve(records);
            })
                .on('error', (error) => {
                reject(error);
            });
        });
    }
    getStudentTemplate() {
        return `name,grade_level,section,
"Doe, John A",Grade 7,7-A,
"Smith, Jane B",Grade 8,8-B,
"Garcia, Maria C",Grade 11,11-STEM,`;
    }
    getBookTemplate() {
        return `accession_no,isbn,title,author,edition,volume,pages,source_of_fund,cost_price,publisher,year,remarks
ACC-001,978-0-13-468599-1,Effective Java,Joshua Bloch,3rd Edition,1,416,School Budget,1200.00,Addison-Wesley,2018,Good condition
ACC-002,978-1-4919-0409-0,Design Patterns,Erich Gamma,1st Edition,1,395,Donation,0,Addison-Wesley,1994,Classic book`;
    }
    getEquipmentTemplate() {
        return `equipment_id,name,type,location,max_time_minutes,requires_supervision,description
COMP-01,Desktop Computer 1,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
COMP-02,Desktop Computer 2,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
GAME-01,PlayStation 5,GAMING,Gaming Room,30,Yes,Sony PlayStation 5 with controller`;
    }
}
exports.ImportService = ImportService;
exports.importService = new ImportService();
exports.default = exports.importService;
//# sourceMappingURL=importService.js.map