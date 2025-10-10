"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEquipment = getEquipment;
exports.getEquipmentById = getEquipmentById;
exports.getEquipmentByEquipmentId = getEquipmentByEquipmentId;
exports.createEquipment = createEquipment;
exports.updateEquipment = updateEquipment;
exports.deleteEquipment = deleteEquipment;
exports.useEquipment = useEquipment;
exports.releaseEquipment = releaseEquipment;
exports.getEquipmentUsageHistory = getEquipmentUsageHistory;
exports.getEquipmentStatistics = getEquipmentStatistics;
const prisma_1 = require("@/utils/prisma");
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
async function getEquipment(options = {}) {
    try {
        const { type, status, page = 1, limit = 50, search } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (type) {
            where.type = type;
        }
        if (status) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { equipmentId: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [equipment, total] = await Promise.all([
            prisma_1.prisma.equipment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma_1.prisma.equipment.count({ where }),
        ]);
        return {
            equipment,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment', {
            error: error.message,
            options,
        });
        throw error;
    }
}
async function getEquipmentById(id) {
    try {
        const equipment = await prisma_1.prisma.equipment.findUnique({
            where: { id },
            include: {
                activities: {
                    where: { status: client_1.ActivityStatus.ACTIVE },
                    orderBy: { startTime: 'desc' },
                    take: 1,
                    include: {
                        student: {
                            select: {
                                studentId: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });
        return equipment;
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment by ID', {
            error: error.message,
            id,
        });
        throw error;
    }
}
async function getEquipmentByEquipmentId(equipmentId) {
    try {
        const equipment = await prisma_1.prisma.equipment.findUnique({
            where: { equipmentId },
            include: {
                activities: {
                    where: { status: client_1.ActivityStatus.ACTIVE },
                    orderBy: { startTime: 'desc' },
                    take: 1,
                    include: {
                        student: {
                            select: {
                                studentId: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });
        return equipment;
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment by equipment ID', {
            error: error.message,
            equipmentId,
        });
        throw error;
    }
}
async function createEquipment(data) {
    try {
        const equipment = await prisma_1.prisma.equipment.create({
            data: {
                equipmentId: data.equipmentId,
                name: data.name,
                type: data.type,
                location: data.location,
                maxTimeMinutes: data.maxTimeMinutes,
                requiresSupervision: data.requiresSupervision || false,
                description: data.description || null,
                status: client_1.EquipmentStatus.AVAILABLE,
            },
        });
        logger_1.logger.info('Equipment created successfully', {
            equipmentId: equipment.equipmentId,
        });
        return equipment;
    }
    catch (error) {
        logger_1.logger.error('Error creating equipment', {
            error: error.message,
            data,
        });
        throw error;
    }
}
async function updateEquipment(id, data) {
    try {
        const equipment = await prisma_1.prisma.equipment.update({
            where: { id },
            data,
        });
        logger_1.logger.info('Equipment updated successfully', { equipmentId: id });
        return equipment;
    }
    catch (error) {
        logger_1.logger.error('Error updating equipment', {
            error: error.message,
            id,
            data,
        });
        throw error;
    }
}
async function deleteEquipment(id) {
    try {
        await prisma_1.prisma.equipment.delete({
            where: { id },
        });
        logger_1.logger.info('Equipment deleted successfully', { equipmentId: id });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Error deleting equipment', {
            error: error.message,
            id,
        });
        throw error;
    }
}
async function useEquipment(data) {
    try {
        const equipment = await prisma_1.prisma.equipment.findUnique({
            where: { id: data.equipmentId },
        });
        if (!equipment) {
            throw new Error('Equipment not found');
        }
        if (equipment.status !== client_1.EquipmentStatus.AVAILABLE) {
            throw new Error('Equipment is not available for use');
        }
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() +
            (data.timeLimitMinutes || equipment.maxTimeMinutes) * 60000);
        const activity = await prisma_1.prisma.activity.create({
            data: {
                studentId: data.studentId,
                activityType: data.activityType,
                equipmentId: data.equipmentId,
                startTime,
                endTime,
                timeLimitMinutes: data.timeLimitMinutes || equipment.maxTimeMinutes,
                notes: data.notes || null,
                status: client_1.ActivityStatus.ACTIVE,
                processedBy: 'System',
            },
            include: {
                student: {
                    select: {
                        studentId: true,
                        firstName: true,
                        lastName: true,
                        gradeLevel: true,
                        gradeCategory: true,
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
        });
        await prisma_1.prisma.equipment.update({
            where: { id: data.equipmentId },
            data: {
                status: client_1.EquipmentStatus.IN_USE,
            },
        });
        logger_1.logger.info('Equipment used successfully', {
            activityId: activity.id,
            equipmentId: data.equipmentId,
            studentId: data.studentId,
        });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error using equipment', {
            error: error.message,
            data,
        });
        throw error;
    }
}
async function releaseEquipment(activityId) {
    try {
        const activity = await prisma_1.prisma.activity.findUnique({
            where: { id: activityId },
            include: {
                equipment: true,
            },
        });
        if (!activity) {
            throw new Error('Activity not found');
        }
        if (!activity.equipmentId) {
            throw new Error('Activity is not associated with equipment');
        }
        const now = new Date();
        const updatedActivity = await prisma_1.prisma.activity.update({
            where: { id: activityId },
            data: {
                endTime: now,
                status: client_1.ActivityStatus.COMPLETED,
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
                        type: true,
                    },
                },
            },
        });
        if (activity.startTime) {
            const duration = Math.floor((now.getTime() - activity.startTime.getTime()) / 60000);
            await prisma_1.prisma.activity.update({
                where: { id: activityId },
                data: { durationMinutes: duration },
            });
        }
        await prisma_1.prisma.equipment.update({
            where: { id: activity.equipmentId },
            data: {
                status: client_1.EquipmentStatus.AVAILABLE,
            },
        });
        logger_1.logger.info('Equipment released successfully', {
            activityId,
            equipmentId: activity.equipmentId,
        });
        return updatedActivity;
    }
    catch (error) {
        logger_1.logger.error('Error releasing equipment', {
            error: error.message,
            activityId,
        });
        throw error;
    }
}
async function getEquipmentUsageHistory(options = {}) {
    try {
        const { equipmentId, studentId, activityType, startDate, endDate, page = 1, limit = 50, } = options;
        const skip = (page - 1) * limit;
        const where = {
            equipmentId: { not: null },
        };
        if (equipmentId) {
            where.equipmentId = equipmentId;
        }
        if (studentId) {
            where.studentId = studentId;
        }
        if (activityType) {
            where.activityType = activityType;
        }
        if (startDate || endDate) {
            where.startTime = {};
            if (startDate)
                where.startTime.gte = startDate;
            if (endDate)
                where.startTime.lte = endDate;
        }
        const [activities, total] = await Promise.all([
            prisma_1.prisma.activity.findMany({
                where,
                skip,
                take: limit,
                orderBy: { startTime: 'desc' },
                include: {
                    student: {
                        select: {
                            studentId: true,
                            firstName: true,
                            lastName: true,
                            gradeLevel: true,
                            gradeCategory: true,
                        },
                    },
                    equipment: {
                        select: {
                            equipmentId: true,
                            name: true,
                            type: true,
                            location: true,
                        },
                    },
                },
            }),
            prisma_1.prisma.activity.count({ where }),
        ]);
        return {
            activities,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment usage history', {
            error: error.message,
            options,
        });
        throw error;
    }
}
async function getEquipmentStatistics() {
    try {
        const [totalEquipment, availableEquipment, inUseEquipment, maintenanceEquipment, equipmentByType,] = await Promise.all([
            prisma_1.prisma.equipment.count(),
            prisma_1.prisma.equipment.count({
                where: {
                    status: client_1.EquipmentStatus.AVAILABLE,
                },
            }),
            prisma_1.prisma.equipment.count({
                where: {
                    status: client_1.EquipmentStatus.IN_USE,
                },
            }),
            prisma_1.prisma.equipment.count({
                where: {
                    status: client_1.EquipmentStatus.MAINTENANCE,
                },
            }),
            prisma_1.prisma.equipment.groupBy({
                by: ['type'],
                _count: {
                    id: true,
                },
            }),
        ]);
        return {
            total: totalEquipment,
            available: availableEquipment,
            inUse: inUseEquipment,
            maintenance: maintenanceEquipment,
            byType: equipmentByType.map(item => ({
                type: item.type,
                count: item._count.id || 0,
            })),
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment statistics', {
            error: error.message,
        });
        throw error;
    }
}
//# sourceMappingURL=equipmentService.js.map