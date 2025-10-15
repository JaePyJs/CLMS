"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scanService_1 = require("@/services/scanService");
const client_1 = require("@prisma/client");
const logger_1 = require("@/utils/logger");
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({
                success: false,
                error: 'Barcode is required',
                timestamp: new Date().toISOString()
            });
        }
        const result = await (0, scanService_1.scanBarcode)(barcode);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error scanning barcode', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/student/checkin', async (req, res) => {
    try {
        const { studentId, activityType, notes } = req.body;
        if (!studentId || !activityType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: studentId, activityType',
                timestamp: new Date().toISOString()
            });
        }
        const activity = await (0, scanService_1.processStudentCheckIn)(studentId, activityType, notes);
        const response = {
            success: true,
            data: activity,
            message: 'Student check-in processed successfully',
            timestamp: new Date().toISOString()
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error processing student check-in', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/student/checkout', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: studentId',
                timestamp: new Date().toISOString()
            });
        }
        const activity = await (0, scanService_1.processStudentCheckOut)(studentId);
        const response = {
            success: true,
            data: activity,
            message: 'Student check-out processed successfully',
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error processing student check-out', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/book/checkout', async (req, res) => {
    try {
        const { bookId, studentId, dueDate, notes } = req.body;
        if (!bookId || !studentId || !dueDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: bookId, studentId, dueDate',
                timestamp: new Date().toISOString()
            });
        }
        const checkout = await (0, scanService_1.processBookCheckout)(bookId, studentId, new Date(dueDate), notes);
        const response = {
            success: true,
            data: checkout,
            message: 'Book checkout processed successfully',
            timestamp: new Date().toISOString()
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error processing book checkout', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/book/return', async (req, res) => {
    try {
        const { checkoutId } = req.body;
        if (!checkoutId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: checkoutId',
                timestamp: new Date().toISOString()
            });
        }
        const checkout = await (0, scanService_1.processBookReturn)(checkoutId);
        const response = {
            success: true,
            data: checkout,
            message: 'Book return processed successfully',
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error processing book return', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/equipment/use', async (req, res) => {
    try {
        const { equipmentId, studentId, activityType, notes } = req.body;
        if (!equipmentId || !studentId || !activityType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: equipmentId, studentId, activityType',
                timestamp: new Date().toISOString()
            });
        }
        const activity = await (0, scanService_1.processEquipmentUse)(equipmentId, studentId, activityType, notes);
        const response = {
            success: true,
            data: activity,
            message: 'Equipment use processed successfully',
            timestamp: new Date().toISOString()
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error processing equipment use', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/equipment/release', async (req, res) => {
    try {
        const { activityId } = req.body;
        if (!activityId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: activityId',
                timestamp: new Date().toISOString()
            });
        }
        const activity = await (0, scanService_1.processEquipmentRelease)(activityId);
        const response = {
            success: true,
            data: activity,
            message: 'Equipment release processed successfully',
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error processing equipment release', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/status/student/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Student ID is required',
                timestamp: new Date().toISOString()
            });
        }
        const status = await (0, scanService_1.getStudentStatus)(id);
        const response = {
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error getting student status', { error: error.message, id: req.params.id });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/status/book/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Book ID is required',
                timestamp: new Date().toISOString()
            });
        }
        const status = await (0, scanService_1.getBookStatus)(id);
        const response = {
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error getting book status', { error: error.message, id: req.params.id });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/status/equipment/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Equipment ID is required',
                timestamp: new Date().toISOString()
            });
        }
        const status = await (0, scanService_1.getEquipmentStatus)(id);
        const response = {
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error getting equipment status', { error: error.message, id: req.params.id });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/student/register', async (req, res) => {
    try {
        const { studentId, firstName, lastName, gradeLevel, gradeCategory, section } = req.body;
        if (!studentId || !firstName || !lastName || !gradeLevel || !gradeCategory) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: studentId, firstName, lastName, gradeLevel, gradeCategory',
                timestamp: new Date().toISOString()
            });
        }
        const student = await (0, scanService_1.registerStudent)({
            studentId,
            firstName,
            lastName,
            gradeLevel,
            gradeCategory,
            section
        });
        const response = {
            success: true,
            data: student,
            message: 'Student registered successfully',
            timestamp: new Date().toISOString()
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error registering student', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/student/scan', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: studentId',
                timestamp: new Date().toISOString()
            });
        }
        const result = await (0, scanService_1.scanStudentBarcode)(studentId);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error scanning student barcode', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/student/:studentId/duplicate-check', async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: studentId',
                timestamp: new Date().toISOString()
            });
        }
        const isDuplicate = await (0, scanService_1.checkDuplicateScan)(studentId);
        const response = {
            success: true,
            data: { isDuplicate },
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error checking duplicate scan', { error: error.message, studentId: req.params.studentId });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/student/self-checkin', async (req, res) => {
    try {
        const { studentId, firstName, lastName, gradeLevel, gradeCategory, section } = req.body;
        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: studentId',
                timestamp: new Date().toISOString()
            });
        }
        const scanResult = await (0, scanService_1.scanStudentBarcode)(studentId);
        if (scanResult.data.requiresRegistration) {
            if (!firstName || !lastName || !gradeLevel || !gradeCategory) {
                return res.status(400).json({
                    success: false,
                    error: 'Student not found and missing registration data. Please provide: firstName, lastName, gradeLevel, gradeCategory',
                    timestamp: new Date().toISOString()
                });
            }
            await (0, scanService_1.registerStudent)({
                studentId,
                firstName,
                lastName,
                gradeLevel,
                gradeCategory,
                section
            });
        }
        const activity = await (0, scanService_1.processStudentCheckIn)(studentId, client_1.ActivityType.GENERAL_VISIT);
        const response = {
            success: true,
            data: {
                activity,
                wasRegistered: scanResult.data.requiresRegistration,
                isDuplicate: scanResult.data.isDuplicate
            },
            message: scanResult.data.requiresRegistration
                ? 'Student registered and checked in successfully'
                : 'Student checked in successfully',
            timestamp: new Date().toISOString()
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error in self-service check-in', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/student/self-checkout', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: studentId',
                timestamp: new Date().toISOString()
            });
        }
        const activity = await (0, scanService_1.processStudentCheckOut)(studentId);
        const response = {
            success: true,
            data: activity,
            message: 'Student checked out successfully',
            timestamp: new Date().toISOString()
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error in self-service check-out', { error: error.message, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
