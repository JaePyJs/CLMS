"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const equipmentService_1 = require("@/services/equipmentService");
const logger_1 = require("@/utils/logger");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { type, status, page = '1', limit = '50', search } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
        };
        if (type) {
            options.type = type;
        }
        if (status) {
            options.status = status;
        }
        if (search) {
            options.search = search;
        }
        const result = await (0, equipmentService_1.getEquipment)(options);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment', {
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
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Equipment ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const equipment = await (0, equipmentService_1.getEquipmentById)(id);
        if (!equipment) {
            return res.status(404).json({
                success: false,
                error: 'Equipment not found',
                timestamp: new Date().toISOString(),
            });
        }
        const response = {
            success: true,
            data: equipment,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment', {
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
        const { equipmentId, name, type, location, maxTimeMinutes, requiresSupervision, description, } = req.body;
        if (!equipmentId || !name || !type || !location || !maxTimeMinutes) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: equipmentId, name, type, location, maxTimeMinutes',
                timestamp: new Date().toISOString(),
            });
        }
        const equipment = await (0, equipmentService_1.createEquipment)({
            equipmentId,
            name,
            type,
            location,
            maxTimeMinutes,
            requiresSupervision,
            description,
        });
        const response = {
            success: true,
            data: equipment,
            message: 'Equipment created successfully',
            timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error creating equipment', {
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
                error: 'Equipment ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const { equipmentId, name, type, location, maxTimeMinutes, requiresSupervision, description, status, } = req.body;
        const equipment = await (0, equipmentService_1.updateEquipment)(id, {
            equipmentId,
            name,
            type,
            location,
            maxTimeMinutes,
            requiresSupervision,
            description,
            status,
        });
        const response = {
            success: true,
            data: equipment,
            message: 'Equipment updated successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error updating equipment', {
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
                error: 'Equipment ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        await (0, equipmentService_1.deleteEquipment)(id);
        const response = {
            success: true,
            message: 'Equipment deleted successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error deleting equipment', {
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
        const equipment = await (0, equipmentService_1.getEquipmentByEquipmentId)(barcode);
        if (!equipment) {
            return res.status(404).json({
                success: false,
                error: 'Equipment not found',
                timestamp: new Date().toISOString(),
            });
        }
        const response = {
            success: true,
            message: 'Equipment found successfully',
            data: equipment,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error scanning equipment barcode', {
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
router.post('/use', async (req, res) => {
    try {
        const { equipmentId, studentId, activityType, timeLimitMinutes, notes } = req.body;
        if (!equipmentId || !studentId || !activityType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: equipmentId, studentId, activityType',
                timestamp: new Date().toISOString(),
            });
        }
        const activity = await (0, equipmentService_1.useEquipment)({
            equipmentId,
            studentId,
            activityType,
            timeLimitMinutes,
            notes,
        });
        const response = {
            success: true,
            data: activity,
            message: 'Equipment used successfully',
            timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Error using equipment', {
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
router.post('/release', async (req, res) => {
    try {
        const { activityId } = req.body;
        if (!activityId) {
            return res.status(400).json({
                success: false,
                error: 'Activity ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        const activity = await (0, equipmentService_1.releaseEquipment)(activityId);
        const response = {
            success: true,
            data: activity,
            message: 'Equipment released successfully',
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error releasing equipment', {
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
router.get('/usage/history', async (req, res) => {
    try {
        const { equipmentId, studentId, activityType, startDate, endDate, page = '1', limit = '50', } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
        };
        if (equipmentId) {
            options.equipmentId = equipmentId;
        }
        if (studentId) {
            options.studentId = studentId;
        }
        if (activityType) {
            options.activityType = activityType;
        }
        if (startDate) {
            options.startDate = new Date(startDate);
        }
        if (endDate) {
            options.endDate = new Date(endDate);
        }
        const result = await (0, equipmentService_1.getEquipmentUsageHistory)(options);
        const response = {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment usage history', {
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
router.get('/statistics', async (req, res) => {
    try {
        const statistics = await (0, equipmentService_1.getEquipmentStatistics)();
        const response = {
            success: true,
            data: statistics,
            timestamp: new Date().toISOString(),
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment statistics', {
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
exports.default = router;
//# sourceMappingURL=equipment.js.map