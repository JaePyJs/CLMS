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
const crypto_1 = require("crypto");
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
const repositories_1 = require("@/repositories");
const prisma_1 = require("@/utils/prisma");
const equipmentRepository = new repositories_1.EquipmentRepository();
async function getEquipment(options = {}) {
    try {
        const queryOptions = {
            page: options.page ?? 1,
            limit: options.limit ?? 50,
        };
        if (options.type !== undefined) {
            queryOptions.type = options.type;
        }
        if (options.status !== undefined) {
            queryOptions.status = options.status;
        }
        if (options.search !== undefined) {
            queryOptions.search = options.search;
        }
        const result = await equipmentRepository.getEquipment(queryOptions);
        return {
            equipment: result.equipment,
            pagination: result.pagination,
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
        const equipment = await equipmentRepository.findById(id);
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
async function getEquipmentByEquipmentId(equipment_id) {
    try {
        const equipment = await equipmentRepository.findByEquipmentId(equipment_id);
        return equipment;
    }
    catch (error) {
        logger_1.logger.error('Error fetching equipment by equipment ID', {
            error: error.message,
            equipment_id,
        });
        throw error;
    }
}
async function createEquipment(data) {
    try {
        const createData = {
            equipment_id: data.equipment_id,
            name: data.name,
            type: data.type,
            location: data.location,
            max_time_minutes: data.max_time_minutes,
        };
        if (data.requires_supervision !== undefined) {
            createData.requires_supervision = data.requires_supervision;
        }
        if (data.description !== undefined) {
            createData.description = data.description;
        }
        const equipment = await equipmentRepository.createEquipment(createData);
        return equipment;
    }
    catch (error) {
        if (error.message === 'Equipment ID already exists') {
            throw error;
        }
        logger_1.logger.error('Error creating equipment', {
            error: error.message,
            data,
        });
        throw error;
    }
}
async function updateEquipment(id, data) {
    try {
        const updateData = {};
        if (data.equipment_id !== undefined)
            updateData.equipment_id = data.equipment_id;
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.type !== undefined)
            updateData.type = data.type;
        if (data.location !== undefined)
            updateData.location = data.location;
        if (data.maxTimeMinutes !== undefined)
            updateData.max_time_minutes = data.maxTimeMinutes;
        if (data.requiresSupervision !== undefined)
            updateData.requires_supervision = data.requiresSupervision;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.status !== undefined)
            updateData.status = data.status;
        const equipment = await equipmentRepository.updateById(id, updateData);
        if (!equipment) {
            logger_1.logger.warn('Attempted to update non-existent equipment', { id });
            return null;
        }
        logger_1.logger.info('Equipment updated successfully', { equipment_id: id });
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
        const success = await equipmentRepository.deleteById(id);
        if (!success) {
            logger_1.logger.warn('Attempted to delete non-existent equipment', { id });
            return false;
        }
        logger_1.logger.info('Equipment deleted successfully', { equipment_id: id });
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
        const equipmentRecord = await prisma_1.prisma.equipment.findFirst({
            where: {
                OR: [{ id: data.equipment_id }, { equipment_id: data.equipment_id }],
            },
        });
        if (!equipmentRecord) {
            throw new Error('Equipment not found');
        }
        if (equipmentRecord.status !== client_1.equipment_status.AVAILABLE) {
            throw new Error('Equipment is not available for use');
        }
        const student = await prisma_1.prisma.students.findFirst({
            where: {
                OR: [{ id: data.student_id }, { student_id: data.student_id }],
            },
        });
        if (!student) {
            throw new Error('Student not found');
        }
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() +
            (data.time_limit_minutes || equipmentRecord.max_time_minutes) * 60000);
        const activity = await prisma_1.prisma.student_activities.create({
            data: {
                id: `activity-${(0, crypto_1.randomUUID)()}`,
                student_id: student.id,
                student_name: `${student.first_name} ${student.last_name}`.trim(),
                grade_level: student.grade_level,
                grade_category: student.grade_category,
                activity_type: data.activity_type,
                equipment_id: equipmentRecord.equipment_id,
                start_time: startTime,
                end_time: endTime,
                time_limit_minutes: data.time_limit_minutes || equipmentRecord.max_time_minutes,
                notes: data.notes || null,
                status: client_1.student_activities_status.ACTIVE,
                processed_by: 'System',
                updated_at: new Date(),
            },
        });
        await prisma_1.prisma.equipment.update({
            where: { id: equipmentRecord.id },
            data: {
                status: client_1.equipment_status.IN_USE,
            },
        });
        logger_1.logger.info('Equipment used successfully', {
            activityId: activity.id,
            equipment_id: equipmentRecord.equipment_id,
            student_id: student.student_id,
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
        const activity = await prisma_1.prisma.student_activities.findUnique({
            where: { id: activityId },
            include: {
                equipment: true,
            },
        });
        if (!activity) {
            throw new Error('Activity not found');
        }
        if (!activity.equipment_id) {
            throw new Error('Activity is not associated with equipment');
        }
        const now = new Date();
        const updatedActivity = await prisma_1.prisma.student_activities.update({
            where: { id: activityId },
            data: {
                end_time: now,
                status: client_1.student_activities_status.COMPLETED,
            },
            include: {
                students: {
                    select: {
                        student_id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                equipment: {
                    select: {
                        equipment_id: true,
                        name: true,
                        type: true,
                    },
                },
            },
        });
        if (activity.start_time) {
            const duration = Math.floor((now.getTime() - activity.start_time.getTime()) / 60000);
            await prisma_1.prisma.student_activities.update({
                where: { id: activityId },
                data: { duration_minutes: duration },
            });
        }
        await equipmentRepository.updateStatus(activity.equipment_id, client_1.equipment_status.AVAILABLE);
        logger_1.logger.info('Equipment released successfully', {
            activityId,
            equipment_id: activity.equipment_id,
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
        const { equipment_id, student_id, activityType, startDate, endDate, page = 1, limit = 50, } = options;
        const skip = (page - 1) * limit;
        const where = {
            equipment_id: { not: null },
        };
        if (equipment_id) {
            where.equipment_id = equipment_id;
        }
        if (student_id) {
            where.student_id = student_id;
        }
        if (activityType) {
            where.activity_type = activityType;
        }
        if (startDate || endDate) {
            const startTimeFilter = {};
            if (startDate) {
                startTimeFilter.gte = startDate;
            }
            if (endDate) {
                startTimeFilter.lte = endDate;
            }
            where.start_time = startTimeFilter;
        }
        const [activities, total] = await Promise.all([
            prisma_1.prisma.student_activities.findMany({
                where,
                skip,
                take: limit,
                orderBy: { start_time: 'desc' },
                include: {
                    students: {
                        select: {
                            student_id: true,
                            first_name: true,
                            last_name: true,
                            grade_level: true,
                            grade_category: true,
                        },
                    },
                    equipment: {
                        select: {
                            equipment_id: true,
                            name: true,
                            type: true,
                            location: true,
                        },
                    },
                },
            }),
            prisma_1.prisma.student_activities.count({ where }),
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
                    status: client_1.equipment_status.AVAILABLE,
                },
            }),
            prisma_1.prisma.equipment.count({
                where: {
                    status: client_1.equipment_status.IN_USE,
                },
            }),
            prisma_1.prisma.equipment.count({
                where: {
                    status: client_1.equipment_status.MAINTENANCE,
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
