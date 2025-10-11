"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleSheetsService = exports.GoogleSheetsService = void 0;
const google_auth_library_1 = require("google-auth-library");
const googleapis_1 = require("googleapis");
const logger_1 = require("@/utils/logger");
const fs_1 = require("fs");
const path_1 = require("path");
const prisma_1 = require("@/utils/prisma");
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
class GoogleSheetsService {
    auth = null;
    sheets = null;
    spreadsheetId = null;
    isInitialized = false;
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            logger_1.logger.info('Initializing Google Sheets service...');
            const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH ||
                (0, path_1.join)(process.cwd(), 'google-credentials.json');
            this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || null;
            if (!this.spreadsheetId) {
                throw new Error('Google Spreadsheet ID is required');
            }
            const credentials = JSON.parse((0, fs_1.readFileSync)(credentialsPath, 'utf8'));
            this.auth = new google_auth_library_1.GoogleAuth({
                credentials,
                scopes: SCOPES,
            });
            this.sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.auth });
            this.isInitialized = true;
            logger_1.logger.info('Google Sheets service initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Google Sheets service', {
                error: error.message,
            });
            throw error;
        }
    }
    async testConnection() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });
            logger_1.logger.info('Google Sheets connection test successful', {
                spreadsheetTitle: response.data.properties?.title,
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Google Sheets connection test failed', {
                error: error.message,
            });
            return false;
        }
    }
    async healthCheck() {
        try {
            const connected = await this.testConnection();
            return { connected };
        }
        catch (error) {
            return {
                connected: false,
                error: error.message,
            };
        }
    }
    async syncAllData() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            logger_1.logger.info('Starting Google Sheets sync for all data');
            const startTime = Date.now();
            let totalRecordsProcessed = 0;
            const studentsResult = await this.syncStudents();
            if (studentsResult.success) {
                totalRecordsProcessed += studentsResult.recordsProcessed || 0;
            }
            const booksResult = await this.syncBooks();
            if (booksResult.success) {
                totalRecordsProcessed += booksResult.recordsProcessed || 0;
            }
            const equipmentResult = await this.syncEquipment();
            if (equipmentResult.success) {
                totalRecordsProcessed += equipmentResult.recordsProcessed || 0;
            }
            const activitiesResult = await this.syncActivities();
            if (activitiesResult.success) {
                totalRecordsProcessed += activitiesResult.recordsProcessed || 0;
            }
            const checkoutsResult = await this.syncBookCheckouts();
            if (checkoutsResult.success) {
                totalRecordsProcessed += checkoutsResult.recordsProcessed || 0;
            }
            const duration = Date.now() - startTime;
            logger_1.logger.info(`Google Sheets sync completed in ${duration}ms`, {
                totalRecordsProcessed,
            });
            return {
                success: true,
                recordsProcessed: totalRecordsProcessed,
            };
        }
        catch (error) {
            logger_1.logger.error('Google Sheets sync failed', {
                error: error.message,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async syncStudents() {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const students = await prisma_1.prisma.student.findMany({
                where: { isActive: true },
                orderBy: { studentId: 'asc' },
            });
            const headers = [
                'Student ID',
                'First Name',
                'Last Name',
                'Grade Level',
                'Grade Category',
                'Section',
                'Created At',
                'Updated At',
            ];
            const rows = students.map(student => [
                student.studentId,
                student.firstName,
                student.lastName,
                student.gradeLevel,
                student.gradeCategory,
                student.section || '',
                student.createdAt.toISOString(),
                student.updatedAt.toISOString(),
            ]);
            await this.updateSheet('Students', headers, rows);
            logger_1.logger.info(`Synced ${students.length} students to Google Sheets`);
            return {
                success: true,
                recordsProcessed: students.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to sync students to Google Sheets', {
                error: error.message,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async syncBooks() {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const books = await prisma_1.prisma.book.findMany({
                where: { isActive: true },
                orderBy: { accessionNo: 'asc' },
            });
            const headers = [
                'Accession No',
                'ISBN',
                'Title',
                'Author',
                'Publisher',
                'Category',
                'Subcategory',
                'Location',
                'Total Copies',
                'Available Copies',
                'Created At',
                'Updated At',
            ];
            const rows = books.map(book => [
                book.accessionNo,
                book.isbn || '',
                book.title,
                book.author,
                book.publisher || '',
                book.category,
                book.subcategory || '',
                book.location || '',
                book.totalCopies.toString(),
                book.availableCopies.toString(),
                book.createdAt.toISOString(),
                book.updatedAt.toISOString(),
            ]);
            await this.updateSheet('Books', headers, rows);
            logger_1.logger.info(`Synced ${books.length} books to Google Sheets`);
            return {
                success: true,
                recordsProcessed: books.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to sync books to Google Sheets', {
                error: error.message,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async syncEquipment() {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const equipment = await prisma_1.prisma.equipment.findMany({
                orderBy: { equipmentId: 'asc' },
            });
            const headers = [
                'Equipment ID',
                'Name',
                'Type',
                'Location',
                'Status',
                'Max Time (minutes)',
                'Requires Supervision',
                'Description',
                'Created At',
                'Updated At',
            ];
            const rows = equipment.map(item => [
                item.equipmentId,
                item.name,
                item.type,
                item.location,
                item.status,
                item.maxTimeMinutes.toString(),
                item.requiresSupervision ? 'Yes' : 'No',
                item.description || '',
                item.createdAt.toISOString(),
                item.updatedAt.toISOString(),
            ]);
            await this.updateSheet('Equipment', headers, rows);
            logger_1.logger.info(`Synced ${equipment.length} equipment items to Google Sheets`);
            return {
                success: true,
                recordsProcessed: equipment.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to sync equipment to Google Sheets', {
                error: error.message,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async syncActivities() {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const activities = await prisma_1.prisma.activity.findMany({
                where: {
                    startTime: { gte: thirtyDaysAgo },
                },
                include: {
                    student: {
                        select: {
                            studentId: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    equipment: {
                        select: {
                            equipmentId: true,
                            name: true,
                        },
                    },
                },
                orderBy: { startTime: 'desc' },
            });
            const headers = [
                'Activity ID',
                'Student ID',
                'Student Name',
                'Activity Type',
                'Equipment ID',
                'Equipment Name',
                'Start Time',
                'End Time',
                'Duration (minutes)',
                'Time Limit (minutes)',
                'Status',
                'Notes',
                'Processed By',
                'Created At',
            ];
            const rows = activities.map(activity => [
                activity.id,
                activity.student?.studentId ?? '',
                activity.student
                    ? `${activity.student.firstName} ${activity.student.lastName}`
                    : '',
                activity.activityType,
                activity.equipment?.equipmentId ?? '',
                activity.equipment?.name ?? '',
                activity.startTime.toISOString(),
                activity.endTime?.toISOString() ?? '',
                activity.durationMinutes?.toString() ?? '',
                activity.timeLimitMinutes?.toString() ?? '',
                activity.status,
                activity.notes ?? '',
                activity.processedBy,
                activity.createdAt.toISOString(),
            ]);
            await this.updateSheet('Activities', headers, rows);
            logger_1.logger.info(`Synced ${activities.length} activities to Google Sheets`);
            return {
                success: true,
                recordsProcessed: activities.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to sync activities to Google Sheets', {
                error: error.message,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async syncBookCheckouts() {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const checkouts = await prisma_1.prisma.bookCheckout.findMany({
                where: {
                    checkoutDate: { gte: thirtyDaysAgo },
                },
                include: {
                    student: {
                        select: {
                            studentId: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    book: {
                        select: {
                            accessionNo: true,
                            title: true,
                            author: true,
                        },
                    },
                },
                orderBy: { checkoutDate: 'desc' },
            });
            const headers = [
                'Checkout ID',
                'Student ID',
                'Student Name',
                'Accession No',
                'Book Title',
                'Book Author',
                'Checkout Date',
                'Due Date',
                'Return Date',
                'Status',
                'Overdue Days',
                'Fine Amount',
                'Fine Paid',
                'Notes',
                'Processed By',
                'Created At',
            ];
            const rows = checkouts.map(checkout => [
                checkout.id,
                checkout.student?.studentId ?? '',
                checkout.student
                    ? `${checkout.student.firstName} ${checkout.student.lastName}`
                    : '',
                checkout.book?.accessionNo ?? '',
                checkout.book?.title ?? '',
                checkout.book?.author ?? '',
                checkout.checkoutDate.toISOString(),
                checkout.dueDate.toISOString(),
                checkout.returnDate?.toISOString() ?? '',
                checkout.status,
                checkout.overdueDays.toString(),
                checkout.fineAmount.toString(),
                checkout.finePaid ? 'Yes' : 'No',
                checkout.notes ?? '',
                checkout.processedBy,
                checkout.createdAt.toISOString(),
            ]);
            await this.updateSheet('Book Checkouts', headers, rows);
            logger_1.logger.info(`Synced ${checkouts.length} book checkouts to Google Sheets`);
            return {
                success: true,
                recordsProcessed: checkouts.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to sync book checkouts to Google Sheets', {
                error: error.message,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async updateSheet(sheetName, headers, rows) {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });
            const sheet = spreadsheet.data.sheets?.find(sheet => sheet.properties?.title === sheetName);
            if (!sheet) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: {
                                        title: sheetName,
                                    },
                                },
                            },
                        ],
                    },
                });
            }
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });
            const data = [headers, ...rows];
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: data,
                },
            });
            logger_1.logger.info(`Updated Google Sheets: ${sheetName} with ${rows.length} rows`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to update Google Sheets: ${sheetName}`, {
                error: error.message,
            });
            throw error;
        }
    }
    async getSheetData(sheetName, range) {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range || `${sheetName}!A:Z`,
            });
            return response.data.values || [];
        }
        catch (error) {
            logger_1.logger.error(`Failed to get data from Google Sheets: ${sheetName}`, {
                error: error.message,
            });
            throw error;
        }
    }
    async getSpreadsheetInfo() {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });
            const title = response.data.properties?.title || 'Unknown';
            const sheets = response.data.sheets?.map(sheet => sheet.properties?.title || 'Untitled') || [];
            return { title, sheets };
        }
        catch (error) {
            logger_1.logger.error('Failed to get spreadsheet info', {
                error: error.message,
            });
            throw error;
        }
    }
    async generateDailyReport(date) {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                throw new Error('Google Sheets service is not properly initialized');
            }
            const targetDate = date || new Date();
            const isoString = targetDate.toISOString();
            const dateString = isoString.split('T')[0] ?? isoString;
            logger_1.logger.info(`Generating daily report for ${dateString}`);
            const startOfDay = new Date(dateString);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(dateString);
            endOfDay.setHours(23, 59, 59, 999);
            const activities = await prisma_1.prisma.activity.findMany({
                where: {
                    startTime: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
                include: {
                    student: {
                        select: {
                            studentId: true,
                            firstName: true,
                            lastName: true,
                            gradeLevel: true,
                        },
                    },
                    equipment: {
                        select: {
                            equipmentId: true,
                            name: true,
                            type: true,
                        },
                    },
                },
                orderBy: { startTime: 'desc' },
            });
            const reportData = {
                date: dateString,
                totalActivities: activities.length,
                activitiesByType: activities.reduce((acc, activity) => {
                    acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
                    return acc;
                }, {}),
                activitiesByGrade: activities.reduce((acc, activity) => {
                    const gradeLevel = activity.student?.gradeLevel ?? 'Unknown';
                    acc[gradeLevel] = (acc[gradeLevel] || 0) + 1;
                    return acc;
                }, {}),
                equipmentUsage: activities.filter(a => a.equipment).length,
                uniqueStudents: new Set(activities
                    .map(activity => activity.student?.studentId)
                    .filter((id) => Boolean(id))).size,
            };
            await this.appendDailyReport(reportData);
            await this.logAutomationTask('daily_report', 'success', `Generated daily report for ${dateString}`, reportData);
            logger_1.logger.info(`Daily report generated for ${dateString}`, reportData);
            return {
                success: true,
                data: reportData,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate daily report', {
                error: error.message,
            });
            await this.logAutomationTask('daily_report', 'error', `Failed to generate daily report: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async ensureSheetHeaders(sheetName, headers) {
        if (!this.sheets || !this.spreadsheetId) {
            throw new Error('Google Sheets service is not properly initialized');
        }
        const spreadsheet = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
        });
        const sheetExists = spreadsheet.data.sheets?.some(sheet => sheet.properties?.title === sheetName);
        if (!sheetExists) {
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
        }
        const existingHeader = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!1:1`,
        });
        if (!existingHeader.data.values ||
            existingHeader.data.values.length === 0) {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [headers],
                },
            });
        }
    }
    async appendDailyReport(report) {
        if (!this.sheets || !this.spreadsheetId) {
            throw new Error('Google Sheets service is not properly initialized');
        }
        const sheetName = 'Daily Reports';
        const headers = [
            'Date',
            'Total Activities',
            'Equipment Usage',
            'Unique Students',
            'Activities By Type',
            'Activities By Grade',
        ];
        await this.ensureSheetHeaders(sheetName, headers);
        const row = [
            report.date,
            report.totalActivities,
            report.equipmentUsage,
            report.uniqueStudents,
            JSON.stringify(report.activitiesByType),
            JSON.stringify(report.activitiesByGrade),
        ];
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A:F`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [row],
            },
        });
    }
    async logAutomationTask(taskType, status, message, data) {
        try {
            if (!this.sheets || !this.spreadsheetId) {
                logger_1.logger.warn('Google Sheets service not initialized, skipping automation task logging');
                return;
            }
            const sheetName = 'Automation Log';
            const headers = [
                'Timestamp',
                'Task Type',
                'Status',
                'Message',
                'Data',
                'Source',
            ];
            await this.ensureSheetHeaders(sheetName, headers);
            const rows = [
                [
                    new Date().toISOString(),
                    taskType,
                    status,
                    message,
                    data ? JSON.stringify(data) : '',
                    'System',
                ],
            ];
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:F`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: rows,
                },
            });
            logger_1.logger.info(`Logged automation task: ${taskType} - ${status}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to log automation task', {
                error: error.message,
            });
        }
    }
    async syncStudentActivities() {
        return this.syncActivities();
    }
    async shutdown() {
        logger_1.logger.info('Shutting down Google Sheets service...');
        this.auth = null;
        this.sheets = null;
        this.spreadsheetId = null;
        this.isInitialized = false;
        logger_1.logger.info('Google Sheets service shutdown complete');
    }
}
exports.GoogleSheetsService = GoogleSheetsService;
exports.googleSheetsService = new GoogleSheetsService();
exports.default = exports.googleSheetsService;
//# sourceMappingURL=googleSheets.js.map