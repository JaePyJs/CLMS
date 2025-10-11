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
                    if (!record.studentId ||
                        !record.firstName ||
                        !record.lastName ||
                        !record.gradeLevel ||
                        !record.gradeCategory) {
                        result.errors.push(`Missing required fields for student: ${JSON.stringify(record)}`);
                        result.errorRecords++;
                        continue;
                    }
                    if (!Object.values(client_1.GradeCategory).includes(record.gradeCategory)) {
                        result.errors.push(`Invalid grade category: ${record.gradeCategory} for student: ${record.studentId}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingStudent = await prisma_1.prisma.student.findUnique({
                        where: { studentId: record.studentId },
                    });
                    if (existingStudent) {
                        logger_1.logger.info(`Student already exists, skipping: ${record.studentId}`);
                        result.skippedRecords++;
                        continue;
                    }
                    await prisma_1.prisma.student.create({
                        data: {
                            studentId: record.studentId,
                            firstName: record.firstName,
                            lastName: record.lastName,
                            gradeLevel: record.gradeLevel,
                            gradeCategory: record.gradeCategory,
                            section: record.section || null,
                        },
                    });
                    result.importedRecords++;
                    logger_1.logger.info(`Imported student: ${record.studentId}`);
                }
                catch (error) {
                    const errorMessage = `Error importing student ${record.studentId}: ${error.message}`;
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
                    if (!record.accessionNo ||
                        !record.title ||
                        !record.author ||
                        !record.category ||
                        !record.totalCopies) {
                        result.errors.push(`Missing required fields for book: ${JSON.stringify(record)}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingBook = await prisma_1.prisma.book.findUnique({
                        where: { accessionNo: record.accessionNo },
                    });
                    if (existingBook) {
                        logger_1.logger.info(`Book already exists, skipping: ${record.accessionNo}`);
                        result.skippedRecords++;
                        continue;
                    }
                    await prisma_1.prisma.book.create({
                        data: {
                            accessionNo: record.accessionNo,
                            isbn: record.isbn || null,
                            title: record.title,
                            author: record.author,
                            publisher: record.publisher || null,
                            category: record.category,
                            subcategory: record.subcategory || null,
                            location: record.location || null,
                            totalCopies: record.totalCopies,
                            availableCopies: record.totalCopies,
                        },
                    });
                    result.importedRecords++;
                    logger_1.logger.info(`Imported book: ${record.accessionNo}`);
                }
                catch (error) {
                    const errorMessage = `Error importing book ${record.accessionNo}: ${error.message}`;
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
                    if (!record.equipmentId ||
                        !record.name ||
                        !record.type ||
                        !record.location ||
                        !record.maxTimeMinutes) {
                        result.errors.push(`Missing required fields for equipment: ${JSON.stringify(record)}`);
                        result.errorRecords++;
                        continue;
                    }
                    if (!Object.values(client_1.EquipmentType).includes(record.type)) {
                        result.errors.push(`Invalid equipment type: ${record.type} for equipment: ${record.equipmentId}`);
                        result.errorRecords++;
                        continue;
                    }
                    const requiresSupervision = record.requiresSupervision?.toLowerCase() === 'yes' ||
                        record.requiresSupervision?.toLowerCase() === 'true';
                    const existingEquipment = await prisma_1.prisma.equipment.findUnique({
                        where: { equipmentId: record.equipmentId },
                    });
                    if (existingEquipment) {
                        logger_1.logger.info(`Equipment already exists, skipping: ${record.equipmentId}`);
                        result.skippedRecords++;
                        continue;
                    }
                    await prisma_1.prisma.equipment.create({
                        data: {
                            equipmentId: record.equipmentId,
                            name: record.name,
                            type: record.type,
                            location: record.location,
                            maxTimeMinutes: record.maxTimeMinutes,
                            requiresSupervision,
                            description: record.description || null,
                            status: client_1.EquipmentStatus.AVAILABLE,
                        },
                    });
                    result.importedRecords++;
                    logger_1.logger.info(`Imported equipment: ${record.equipmentId}`);
                }
                catch (error) {
                    const errorMessage = `Error importing equipment ${record.equipmentId}: ${error.message}`;
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
        return `studentId,firstName,lastName,gradeLevel,gradeCategory,section
2023001,John,Doe,Grade 7,JUNIOR_HIGH,7-A
2023002,Jane,Smith,Grade 8,JUNIOR_HIGH,8-B`;
    }
    getBookTemplate() {
        return `accessionNo,isbn,title,author,publisher,category,subcategory,location,totalCopies
ACC-001,978-0-13-468599-1,Effective Java,Joshua Bloch,Addison-Wesley,Programming,Java,Stack A,2
ACC-002,978-1-4919-0409-0,Design Patterns,Erich Gamma,Addison-Wesley,Programming,OOP,Stack B,1`;
    }
    getEquipmentTemplate() {
        return `equipmentId,name,type,location,maxTimeMinutes,requiresSupervision,description
COMP-01,Desktop Computer 1,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
COMP-02,Desktop Computer 2,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
GAME-01,PlayStation 5,GAMING,Gaming Room,30,Yes,Sony PlayStation 5 with controller`;
    }
}
exports.ImportService = ImportService;
exports.importService = new ImportService();
exports.default = exports.importService;
//# sourceMappingURL=importService.js.map