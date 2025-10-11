"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const studentService_1 = require("@/services/studentService");
const logger_1 = require("@/utils/logger");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { gradeCategory, isActive, page = '1', limit = '50' } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
        };
        if (gradeCategory) {
            options.gradeCategory = gradeCategory;
        }
        if (isActive !== undefined) {
            options.isActive = isActive === 'true';
        }
        const result = await (0, studentService_1.getStudents)(options);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching students', {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Student ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const student = await (0, studentService_1.getStudentByBarcode)(id);
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found',
                timestamp: new Date().toISOString(),
            });
        }
        const response = {
            success: true,
            data: student,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching student', {
            error: error.message,
            id: req.params.id,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/', async (req, res) => {
    try {
        const { studentId, firstName, lastName, gradeLevel, gradeCategory, section, } = req.body;
        if (!studentId ||
            !firstName ||
            !lastName ||
            !gradeLevel ||
            !gradeCategory) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                timestamp: new Date().toISOString(),
            });
        }
        const student = await (0, studentService_1.createStudent)({
            studentId,
            firstName,
            lastName,
            gradeLevel,
            gradeCategory,
            section,
        });
        const response = {
            success: true,
            data: student,
            message: 'Student created successfully',
            timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error creating student', {
            error: error.message,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Student ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const { firstName, lastName, gradeLevel, gradeCategory, section, isActive, } = req.body;
        const student = await (0, studentService_1.updateStudent)(id, {
            firstName,
            lastName,
            gradeLevel,
            gradeCategory,
            section,
            isActive,
        });
        const response = {
            success: true,
            data: student,
            message: 'Student updated successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error updating student', {
            error: error.message,
            id: req.params.id,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Student ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        await (0, studentService_1.deleteStudent)(id);
        const response = {
            success: true,
            message: 'Student deleted successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error deleting student', {
            error: error.message,
            id: req.params.id,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/activities/all', async (req, res) => {
    try {
        const { studentId, startDate, endDate, activityType, status, page = '1', limit = '50', } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
        };
        if (studentId) {
            options.studentId = studentId;
        }
        if (startDate) {
            options.startDate = new Date(startDate);
        }
        if (endDate) {
            options.endDate = new Date(endDate);
        }
        if (activityType) {
            options.activityType = activityType;
        }
        if (status) {
            options.status = status;
        }
        const result = await (0, studentService_1.getStudentActivities)(options);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching student activities', {
            error: error.message,
            query: req.query,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.get('/activities/active', async (req, res) => {
    try {
        const activities = await (0, studentService_1.getActiveSessions)();
        const response = {
            success: true,
            data: activities,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching active sessions', {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/activities', async (req, res) => {
    try {
        const { studentId, activityType, equipmentId, timeLimitMinutes, notes } = req.body;
        if (!studentId || !activityType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: studentId, activityType',
                timestamp: new Date().toISOString(),
            });
        }
        const activity = await (0, studentService_1.createStudentActivity)({
            studentId,
            activityType,
            equipmentId,
            timeLimitMinutes,
            notes,
        });
        const response = {
            success: true,
            data: activity,
            message: 'Student activity created successfully',
            timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error creating student activity', {
            error: error.message,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.patch('/activities/:id/end', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Activity ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const activity = await (0, studentService_1.endStudentActivity)(id);
        const response = {
            success: true,
            data: activity,
            message: 'Student activity ended successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error ending student activity', {
            error: error.message,
            id: req.params.id,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/scan', async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({
                success: false,
                error: 'Barcode is required',
                timestamp: new Date().toISOString(),
            });
        }
        const student = await (0, studentService_1.getStudentByBarcode)(barcode);
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found',
                timestamp: new Date().toISOString(),
            });
        }
        const response = {
            success: true,
            message: 'Student found successfully',
            data: student,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error scanning student barcode', {
            error: error.message,
            body: req.body,
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
//# sourceMappingURL=students.js.map