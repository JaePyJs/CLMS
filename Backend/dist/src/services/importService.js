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
exports.importService = exports.ImportService = void 0;
const fs_1 = require("fs");
const logger_1 = require("@/utils/logger");
const csv_parse_1 = require("csv-parse");
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
const repositories_1 = require("@/repositories");
const dataTransformationPipeline_1 = require("@/utils/dataTransformationPipeline");
const typeInference_1 = require("@/utils/typeInference");
class ImportService {
    studentsRepository;
    booksRepository;
    equipmentRepository;
    transformationPipeline;
    typeInference;
    constructor() {
        this.studentsRepository = repositories_1.studentsRepository;
        this.booksRepository = repositories_1.booksRepository;
        this.equipmentRepository = repositories_1.equipmentRepository;
        this.transformationPipeline = new dataTransformationPipeline_1.DataTransformationPipeline({
            logLevel: 'info',
            strictMode: false,
            maxErrors: 100,
            skipInvalidRows: true,
            batchSize: 50,
        });
        this.typeInference = new typeInference_1.TypeInference({
            strictMode: false,
            logLevel: 'info',
        });
    }
    async importStudentsWithMapping(filePath, fieldMappings) {
        const result = {
            success: true,
            totalRecords: 0,
            importedRecords: 0,
            updatedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
            warnings: [],
        };
        try {
            logger_1.logger.info(`Starting enhanced student import from ${filePath} using repository pattern`);
            const transformationResult = await this.transformationPipeline.processFile(filePath, 'students', {
                customMappings: this.convertFieldMappingsToDict(fieldMappings),
                dryRun: false,
            });
            result.totalRecords = transformationResult.totalRows;
            const stats = transformationResult.statistics;
            result.transformationStats = {
                typeConversions: this.getStatisticNumber(stats, 'typeConversions'),
                fieldMappings: Object.keys(transformationResult.fieldMappings).length,
                validationErrors: this.getStatisticNumber(stats, 'validationErrors'),
                processingTime: transformationResult.duration,
            };
            result.pipelineErrors = transformationResult.errors;
            for (const rawRecord of transformationResult.data) {
                const record = this.toStringRecord(rawRecord);
                if (!record) {
                    result.errors.push(`Unable to normalize student record: ${JSON.stringify(rawRecord)}`);
                    result.errorRecords++;
                    continue;
                }
                try {
                    if (!record.name || !record.grade_level || !record.section) {
                        result.errors.push(`Missing required fields for student: ${JSON.stringify(rawRecord)}`);
                        result.errorRecords++;
                        continue;
                    }
                    const nameParts = record.name
                        .split(',')
                        .map((part) => part.trim());
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
                        grade_category = client_1.students_grade_category.JUNIOR_HIGH;
                    }
                    else if (gradeNumber >= 11 && gradeNumber <= 12) {
                        grade_category = client_1.students_grade_category.SENIOR_HIGH;
                    }
                    else {
                        result.errors.push(`Invalid grade level: ${record.grade_level} for student: ${record.name}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingStudent = await this.studentsRepository.findByStudentId(student_id);
                    if (existingStudent) {
                        result.warnings.push(`Student already exists, updating: ${student_id}`);
                        result.updatedRecords++;
                    }
                    else {
                        result.importedRecords++;
                    }
                    await this.studentsRepository.upsertByStudentId(student_id, {
                        first_name: firstName,
                        last_name: lastName,
                        grade_level: record.grade_level,
                        grade_category,
                        section: record.section,
                    });
                    logger_1.logger.info(`${existingStudent ? 'Updated' : 'Imported'} student: ${student_id}`);
                }
                catch (error) {
                    const errorMessage = `Error importing student ${record.name}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            transformationResult.errors.forEach(error => {
                if (error.severity === 'error') {
                    result.errors.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
                else {
                    result.warnings.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
            });
            logger_1.logger.info(`Enhanced student import completed using repository pattern`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                updatedRecords: result.updatedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
                processingTime: result.transformationStats?.processingTime,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import students with mapping using repository pattern', {
                error: error.message,
            });
            result.success = false;
            result.errors.push(error.message);
            return result;
        }
    }
    convertFieldMappingsToDict(fieldMappings) {
        const dict = {};
        fieldMappings.forEach(mapping => {
            if (!mapping.targetField) {
                logger_1.logger.warn('Skipping import field mapping without target', {
                    sourceField: mapping.sourceField,
                });
                return;
            }
            dict[mapping.sourceField] = mapping.targetField;
        });
        return dict;
    }
    getStatisticNumber(statistics, key) {
        const value = statistics[key];
        return typeof value === 'number' ? value : 0;
    }
    toStringRecord(record) {
        const normalized = {};
        for (const [key, value] of Object.entries(record)) {
            if (value === undefined || value === null) {
                continue;
            }
            if (typeof value === 'string' || typeof value === 'number') {
                normalized[key] = String(value);
                continue;
            }
            if (typeof value === 'boolean') {
                normalized[key] = value ? 'true' : 'false';
                continue;
            }
            if (value instanceof Date) {
                normalized[key] = value.toISOString();
                continue;
            }
            return null;
        }
        return normalized;
    }
    async importBooksWithMapping(filePath, fieldMappings) {
        const result = {
            success: true,
            totalRecords: 0,
            importedRecords: 0,
            updatedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
            warnings: [],
        };
        try {
            logger_1.logger.info(`Starting enhanced book import from ${filePath} using repository pattern`);
            const transformationResult = await this.transformationPipeline.processFile(filePath, 'books', {
                customMappings: this.convertFieldMappingsToDict(fieldMappings),
                dryRun: false,
            });
            result.totalRecords = transformationResult.totalRows;
            const stats = transformationResult.statistics;
            result.transformationStats = {
                typeConversions: this.getStatisticNumber(stats, 'typeConversions'),
                fieldMappings: Object.keys(transformationResult.fieldMappings).length,
                validationErrors: this.getStatisticNumber(stats, 'validationErrors'),
                processingTime: transformationResult.duration,
            };
            result.pipelineErrors = transformationResult.errors;
            for (const rawRecord of transformationResult.data) {
                const record = this.toStringRecord(rawRecord);
                if (!record) {
                    result.errors.push(`Unable to normalize book record: ${JSON.stringify(rawRecord)}`);
                    result.errorRecords++;
                    continue;
                }
                try {
                    if (!record.accession_no || !record.title || !record.author) {
                        result.errors.push(`Missing required fields for book: ${JSON.stringify(rawRecord)}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingBook = await this.booksRepository.findByAccessionNo(record.accession_no);
                    if (existingBook) {
                        result.warnings.push(`Book already exists, updating: ${record.accession_no}`);
                        result.updatedRecords++;
                    }
                    else {
                        result.importedRecords++;
                    }
                    let cost_price = null;
                    if (record.costPrice) {
                        const parsedCost = parseFloat(record.costPrice.replace(/[^0-9.-]/g, ''));
                        if (!isNaN(parsedCost)) {
                            cost_price = parsedCost;
                        }
                    }
                    let year = null;
                    if (record.year) {
                        const parsedYear = parseInt(record.year, 10);
                        if (!isNaN(parsedYear)) {
                            year = parsedYear;
                        }
                    }
                    const upsertPayload = {
                        title: record.title,
                        author: record.author,
                        category: 'General',
                        total_copies: 1,
                        available_copies: 1,
                    };
                    if (record.isbn) {
                        upsertPayload.isbn = record.isbn;
                    }
                    if (record.publisher) {
                        upsertPayload.publisher = record.publisher;
                    }
                    if (record.subcategory) {
                        upsertPayload.subcategory = record.subcategory;
                    }
                    if (record.location) {
                        upsertPayload.location = record.location;
                    }
                    if (record.edition) {
                        upsertPayload.edition = record.edition;
                    }
                    if (record.volume) {
                        upsertPayload.volume = record.volume;
                    }
                    if (record.pages) {
                        upsertPayload.pages = record.pages;
                    }
                    if (record.sourceOfFund) {
                        upsertPayload.source_of_fund = record.sourceOfFund;
                    }
                    if (record.remarks) {
                        upsertPayload.remarks = record.remarks;
                    }
                    if (cost_price !== null) {
                        upsertPayload.cost_price = cost_price;
                    }
                    if (year !== null) {
                        upsertPayload.year = year;
                    }
                    await this.booksRepository.upsertByAccessionNo(record.accession_no, upsertPayload);
                    logger_1.logger.info(`${existingBook ? 'Updated' : 'Imported'} book: ${record.accession_no}`);
                }
                catch (error) {
                    const errorMessage = `Error importing book ${record.accession_no}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            transformationResult.errors.forEach(error => {
                if (error.severity === 'error') {
                    result.errors.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
                else {
                    result.warnings.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
            });
            logger_1.logger.info(`Enhanced book import completed using repository pattern`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                updatedRecords: result.updatedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
                processingTime: result.transformationStats?.processingTime,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import books with mapping using repository pattern', {
                error: error.message,
            });
            result.success = false;
            result.errors.push(error.message);
            return result;
        }
    }
    async importStudents(filePath) {
        const result = {
            success: true,
            totalRecords: 0,
            importedRecords: 0,
            updatedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
            warnings: [],
        };
        try {
            logger_1.logger.info(`Starting student import from ${filePath} using repository pattern`);
            const transformationResult = await this.transformationPipeline.processFile(filePath, 'students', {
                dryRun: false,
            });
            result.totalRecords = transformationResult.totalRows;
            const stats = transformationResult.statistics;
            result.transformationStats = {
                typeConversions: this.getStatisticNumber(stats, 'typeConversions'),
                fieldMappings: Object.keys(transformationResult.fieldMappings).length,
                validationErrors: this.getStatisticNumber(stats, 'validationErrors'),
                processingTime: transformationResult.duration,
            };
            result.pipelineErrors = transformationResult.errors;
            for (const rawRecord of transformationResult.data) {
                const record = this.toStringRecord(rawRecord);
                if (!record) {
                    result.errors.push(`Unable to normalize student record: ${JSON.stringify(rawRecord)}`);
                    result.errorRecords++;
                    continue;
                }
                try {
                    if (!record.name || !record.grade_level || !record.section) {
                        result.errors.push(`Missing required fields for student: ${JSON.stringify(rawRecord)}`);
                        result.errorRecords++;
                        continue;
                    }
                    const nameParts = record.name
                        .split(',')
                        .map((part) => part.trim());
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
                        grade_category = client_1.students_grade_category.JUNIOR_HIGH;
                    }
                    else if (gradeNumber >= 11 && gradeNumber <= 12) {
                        grade_category = client_1.students_grade_category.SENIOR_HIGH;
                    }
                    else {
                        result.errors.push(`Invalid grade level: ${record.grade_level} for student: ${record.name}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingStudent = await this.studentsRepository.findByStudentId(student_id);
                    if (existingStudent) {
                        result.warnings.push(`Student already exists, updating: ${student_id}`);
                        result.updatedRecords++;
                    }
                    else {
                        result.importedRecords++;
                    }
                    await this.studentsRepository.upsertByStudentId(student_id, {
                        first_name: firstName,
                        last_name: lastName,
                        grade_level: record.grade_level,
                        grade_category,
                        section: record.section,
                    });
                    logger_1.logger.info(`${existingStudent ? 'Updated' : 'Imported'} student: ${student_id}`);
                }
                catch (error) {
                    const errorMessage = `Error importing student ${record.name}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            transformationResult.errors.forEach(error => {
                if (error.severity === 'error') {
                    result.errors.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
                else {
                    result.warnings.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
            });
            logger_1.logger.info(`Student import completed using repository pattern`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                updatedRecords: result.updatedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
                processingTime: result.transformationStats?.processingTime,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import students using repository pattern', {
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
            updatedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
            warnings: [],
        };
        try {
            logger_1.logger.info(`Starting book import from ${filePath} using repository pattern`);
            const transformationResult = await this.transformationPipeline.processFile(filePath, 'books', {
                dryRun: false,
            });
            result.totalRecords = transformationResult.totalRows;
            const stats = transformationResult.statistics;
            result.transformationStats = {
                typeConversions: this.getStatisticNumber(stats, 'typeConversions'),
                fieldMappings: Object.keys(transformationResult.fieldMappings).length,
                validationErrors: this.getStatisticNumber(stats, 'validationErrors'),
                processingTime: transformationResult.duration,
            };
            result.pipelineErrors = transformationResult.errors;
            for (const rawRecord of transformationResult.data) {
                const record = this.toStringRecord(rawRecord);
                if (!record) {
                    result.errors.push(`Unable to normalize book record: ${JSON.stringify(rawRecord)}`);
                    result.errorRecords++;
                    continue;
                }
                try {
                    if (!record.accession_no || !record.title || !record.author) {
                        result.errors.push(`Missing required fields for book: ${JSON.stringify(rawRecord)}`);
                        result.errorRecords++;
                        continue;
                    }
                    const existingBook = await this.booksRepository.findByAccessionNo(record.accession_no);
                    if (existingBook) {
                        result.warnings.push(`Book already exists, updating: ${record.accession_no}`);
                        result.updatedRecords++;
                    }
                    else {
                        result.importedRecords++;
                    }
                    let cost_price = null;
                    if (record.cost_price) {
                        const parsedCost = parseFloat(record.cost_price.replace(/[^0-9.-]/g, ''));
                        if (!isNaN(parsedCost)) {
                            cost_price = parsedCost;
                        }
                    }
                    let year = null;
                    if (record.year) {
                        const parsedYear = parseInt(record.year, 10);
                        if (!isNaN(parsedYear)) {
                            year = parsedYear;
                        }
                    }
                    const upsertPayload = {
                        title: record.title,
                        author: record.author,
                        category: 'General',
                        total_copies: 1,
                        available_copies: 1,
                    };
                    if (record.isbn) {
                        upsertPayload.isbn = record.isbn;
                    }
                    if (record.publisher) {
                        upsertPayload.publisher = record.publisher;
                    }
                    if (record.subcategory) {
                        upsertPayload.subcategory = record.subcategory;
                    }
                    if (record.location) {
                        upsertPayload.location = record.location;
                    }
                    if (record.edition) {
                        upsertPayload.edition = record.edition;
                    }
                    if (record.volume) {
                        upsertPayload.volume = record.volume;
                    }
                    if (record.pages) {
                        upsertPayload.pages = record.pages;
                    }
                    if (record.source_of_fund) {
                        upsertPayload.source_of_fund = record.source_of_fund;
                    }
                    if (record.remarks) {
                        upsertPayload.remarks = record.remarks;
                    }
                    if (cost_price !== null) {
                        upsertPayload.cost_price = cost_price;
                    }
                    if (year !== null) {
                        upsertPayload.year = year;
                    }
                    await this.booksRepository.upsertByAccessionNo(record.accession_no, upsertPayload);
                    logger_1.logger.info(`${existingBook ? 'Updated' : 'Imported'} book: ${record.accession_no}`);
                }
                catch (error) {
                    const errorMessage = `Error importing book ${record.accession_no}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            transformationResult.errors.forEach(error => {
                if (error.severity === 'error') {
                    result.errors.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
                else {
                    result.warnings.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
            });
            logger_1.logger.info(`Book import completed using repository pattern`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                updatedRecords: result.updatedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
                processingTime: result.transformationStats?.processingTime,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import books using repository pattern', {
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
            updatedRecords: 0,
            skippedRecords: 0,
            errorRecords: 0,
            errors: [],
            warnings: [],
        };
        try {
            logger_1.logger.info(`Starting equipment import from ${filePath} using repository pattern`);
            const transformationResult = await this.transformationPipeline.processFile(filePath, 'equipment', {
                dryRun: false,
            });
            result.totalRecords = transformationResult.totalRows;
            const stats = transformationResult.statistics;
            result.transformationStats = {
                typeConversions: this.getStatisticNumber(stats, 'typeConversions'),
                fieldMappings: Object.keys(transformationResult.fieldMappings).length,
                validationErrors: this.getStatisticNumber(stats, 'validationErrors'),
                processingTime: transformationResult.duration,
            };
            result.pipelineErrors = transformationResult.errors;
            for (const record of transformationResult.data) {
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
                    const maxTimeMinutes = Number(record.max_time_minutes);
                    if (Number.isNaN(maxTimeMinutes)) {
                        result.errors.push(`Invalid max_time_minutes value for equipment: ${record.equipment_id}`);
                        result.errorRecords++;
                        continue;
                    }
                    if (!Object.values(client_1.equipment_type).includes(record.type)) {
                        result.errors.push(`Invalid equipment type: ${record.type} for equipment: ${record.equipment_id}`);
                        result.errorRecords++;
                        continue;
                    }
                    const requiresSupervisionValue = (record.requires_supervision ??
                        record.requiresSupervision ??
                        '').toLowerCase();
                    const requiresSupervisionFlag = requiresSupervisionValue === 'yes' ||
                        requiresSupervisionValue === 'true';
                    const existingEquipment = await this.equipmentRepository.findByEquipmentId(record.equipment_id);
                    if (existingEquipment) {
                        result.warnings.push(`Equipment already exists, updating: ${record.equipment_id}`);
                        result.updatedRecords++;
                    }
                    else {
                        result.importedRecords++;
                    }
                    const equipmentPayload = {
                        name: record.name,
                        type: record.type,
                        location: record.location,
                        max_time_minutes: maxTimeMinutes,
                        requires_supervision: requiresSupervisionFlag,
                        status: client_1.equipment_status.AVAILABLE,
                    };
                    if (record.description) {
                        equipmentPayload.description = record.description;
                    }
                    await this.equipmentRepository.upsertByEquipmentId(record.equipment_id, equipmentPayload);
                    logger_1.logger.info(`${existingEquipment ? 'Updated' : 'Imported'} equipment: ${record.equipment_id}`);
                }
                catch (error) {
                    const errorMessage = `Error importing equipment ${record.equipment_id}: ${error.message}`;
                    result.errors.push(errorMessage);
                    result.errorRecords++;
                    logger_1.logger.error(errorMessage);
                }
            }
            transformationResult.errors.forEach(error => {
                if (error.severity === 'error') {
                    result.errors.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
                else {
                    result.warnings.push(`Row ${error.row}, Field ${error.field}: ${error.message}`);
                }
            });
            logger_1.logger.info(`Equipment import completed using repository pattern`, {
                totalRecords: result.totalRecords,
                importedRecords: result.importedRecords,
                updatedRecords: result.updatedRecords,
                skippedRecords: result.skippedRecords,
                errorRecords: result.errorRecords,
                processingTime: result.transformationStats?.processingTime,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to import equipment using repository pattern', {
                error: error.message,
            });
            result.success = false;
            result.errors.push(error.message);
            return result;
        }
    }
    async previewFile(filePath, options = {}) {
        try {
            logger_1.logger.info(`Starting file preview using transformation pipeline: ${filePath}`);
            const entityType = options.entityType ?? 'students';
            const pipelineOptions = { dryRun: true };
            if (options.fieldMappings?.length) {
                pipelineOptions.customMappings = this.convertFieldMappingsToDict(options.fieldMappings);
            }
            const transformationResult = await this.transformationPipeline.processFile(filePath, entityType, pipelineOptions);
            const headers = Object.keys(transformationResult.fieldMappings);
            const rows = transformationResult.data
                .slice(0, options.maxPreviewRows || 10)
                .map(record => headers.map(header => String(record[header] || '')));
            const suggestedMappings = Object.entries(transformationResult.fieldMappings).reduce((accumulator, [sourceField, mapping]) => {
                if (!mapping.targetField) {
                    return accumulator;
                }
                accumulator.push({
                    sourceField,
                    targetField: mapping.targetField,
                    required: mapping.confidence > 0.8,
                });
                return accumulator;
            }, []);
            const previewData = {
                headers,
                rows,
                totalRows: transformationResult.totalRows,
                suggestedMappings,
                fileType: filePath.endsWith('.csv') ? 'csv' : 'excel',
            };
            logger_1.logger.info('File preview completed using transformation pipeline', {
                totalRows: previewData.totalRows,
                previewRows: previewData.rows.length,
                headers: previewData.headers.length,
                suggestedMappings: previewData.suggestedMappings.length,
            });
            return previewData;
        }
        catch (error) {
            logger_1.logger.error('Error previewing file with transformation pipeline', {
                error: error.message,
                filePath,
            });
            throw error;
        }
    }
    async previewCsvFile(filePath, options) {
        return new Promise((resolve, reject) => {
            const flatValues = [];
            let headers = [];
            (0, fs_1.createReadStream)(filePath)
                .pipe((0, csv_parse_1.parse)({
                columns: true,
                skip_empty_lines: true,
                trim: true,
            }))
                .on('data', (record) => {
                if (headers.length === 0) {
                    headers = Object.keys(record);
                }
                const values = Object.values(record).map(value => String(value ?? ''));
                flatValues.push(...values);
            })
                .on('end', () => {
                const rows = this.chunkArray(flatValues, headers.length);
                const suggestedMappings = this.generateSuggestedMappings(headers, 'students');
                resolve({
                    headers,
                    rows: rows.slice(0, options.maxPreviewRows || 10),
                    totalRows: rows.length,
                    suggestedMappings,
                    fileType: 'csv',
                });
            })
                .on('error', (error) => {
                reject(error);
            });
        });
    }
    async previewExcelFile(filePath, options) {
        const workbook = XLSX.readFile(filePath);
        const [sheetName] = workbook.SheetNames;
        if (!sheetName) {
            throw new Error('Excel workbook does not contain any sheets');
        }
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            throw new Error(`Worksheet "${sheetName}" not found in workbook`);
        }
        const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
        });
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
            fileType: 'excel',
        };
    }
    async parseFile(filePath, options = {}) {
        const fileExtension = filePath.split('.').pop()?.toLowerCase();
        if (fileExtension === 'csv') {
            return this.parseCsvFileWithMapping(filePath, options);
        }
        else if (['xlsx', 'xls'].includes(fileExtension || '')) {
            return this.parseExcelFile(filePath, options);
        }
        else {
            throw new Error('Unsupported file format. Only CSV and Excel files are supported.');
        }
    }
    async parseCsvFileWithMapping(filePath, options) {
        return new Promise((resolve, reject) => {
            const records = [];
            let headers = [];
            (0, fs_1.createReadStream)(filePath)
                .pipe((0, csv_parse_1.parse)({
                columns: true,
                skip_empty_lines: true,
                trim: true,
            }))
                .on('data', (record) => {
                if (headers.length === 0) {
                    headers = Object.keys(record);
                }
                if (options.fieldMappings && options.fieldMappings.length > 0) {
                    const mappedRecord = {};
                    for (const mapping of options.fieldMappings) {
                        const sourceIndex = headers.findIndex(h => h.toLowerCase().includes(mapping.sourceField.toLowerCase()) ||
                            mapping.sourceField.toLowerCase().includes(h.toLowerCase()));
                        if (sourceIndex !== -1) {
                            const sourceHeader = headers[sourceIndex];
                            if (!sourceHeader) {
                                logger_1.logger.warn('Skipping source header with undefined value during CSV parse', {
                                    sourceField: mapping.sourceField,
                                });
                                continue;
                            }
                            const targetField = mapping.targetField;
                            if (!targetField) {
                                logger_1.logger.warn('Skipping import field mapping without target during CSV parse', {
                                    sourceField: mapping.sourceField,
                                });
                                continue;
                            }
                            mappedRecord[targetField] = record[sourceHeader];
                        }
                        else if (mapping.required) {
                            throw new Error(`Required field "${mapping.sourceField}" not found in file`);
                        }
                    }
                    records.push(mappedRecord);
                }
                else {
                    records.push(record);
                }
            })
                .on('end', () => {
                resolve(records);
            })
                .on('error', (error) => {
                reject(error);
            });
        });
    }
    async parseExcelFile(filePath, options) {
        const workbook = XLSX.readFile(filePath);
        const [sheetName] = workbook.SheetNames;
        if (!sheetName) {
            throw new Error('Excel workbook does not contain any sheets');
        }
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            throw new Error(`Worksheet "${sheetName}" not found in workbook`);
        }
        const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
        });
        if (data.length === 0) {
            return [];
        }
        const headers = data[0] || [];
        const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));
        const records = [];
        for (const row of rows) {
            const record = {};
            if (options.fieldMappings && options.fieldMappings.length > 0) {
                for (const mapping of options.fieldMappings) {
                    const sourceIndex = headers.findIndex(h => h.toLowerCase().includes(mapping.sourceField.toLowerCase()) ||
                        mapping.sourceField.toLowerCase().includes(h.toLowerCase()));
                    if (sourceIndex !== -1) {
                        const targetField = mapping.targetField;
                        if (!targetField) {
                            logger_1.logger.warn('Skipping import field mapping without target during Excel parse', {
                                sourceField: mapping.sourceField,
                            });
                            continue;
                        }
                        record[targetField] = row[sourceIndex];
                    }
                    else if (mapping.required) {
                        throw new Error(`Required field "${mapping.sourceField}" not found in file`);
                    }
                }
            }
            else {
                headers.forEach((header, index) => {
                    if (!header) {
                        return;
                    }
                    record[header] = row[index];
                });
            }
            records.push(record);
        }
        return records;
    }
    generateSuggestedMappings(headers, importType) {
        const mappings = [];
        if (importType === 'students') {
            const studentFields = ['name', 'grade_level', 'section'];
            for (const field of studentFields) {
                const matchedHeader = headers.find(h => h.toLowerCase().includes(field.toLowerCase()) ||
                    field.toLowerCase().includes(h.toLowerCase()));
                if (matchedHeader) {
                    mappings.push({
                        sourceField: matchedHeader,
                        targetField: field,
                        required: true,
                    });
                }
            }
        }
        return mappings;
    }
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
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
