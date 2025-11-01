"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultTimeLimit = getDefaultTimeLimit;
exports.getStudentByBarcode = getStudentByBarcode;
exports.getStudentById = getStudentById;
exports.getStudents = getStudents;
exports.createStudent = createStudent;
exports.updateStudent = updateStudent;
exports.deleteStudent = deleteStudent;
exports.getStudentActivities = getStudentActivities;
exports.getActiveSessions = getActiveSessions;
exports.createStudentActivity = createStudentActivity;
exports.endStudentActivity = endStudentActivity;
const logger_1 = require("@/utils/logger");
const errorHandler_1 = require("@/utils/errorHandler");
const client_1 = require("@prisma/client");
const performanceOptimizationService_1 = require("./performanceOptimizationService");
const repositories_1 = require("@/repositories");
const prisma_1 = require("@/utils/prisma");
const errorHandler = (0, errorHandler_1.createServiceErrorHandler)('studentService');
const studentsRepository = new repositories_1.StudentsRepository();
function getDefaultTimeLimit(grade_category) {
    const timeLimits = {
        PRIMARY: parseInt(process.env.PRIMARY_TIME_LIMIT || '30'),
        GRADE_SCHOOL: parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT || '60'),
        JUNIOR_HIGH: parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT || '90'),
        SENIOR_HIGH: parseInt(process.env.SENIOR_HIGH_TIME_LIMIT || '120'),
    };
    return timeLimits[grade_category] || 60;
}
async function getStudentByBarcode(barcode) {
    return performanceOptimizationService_1.performanceOptimizationService.executeQuery('student_by_barcode', async () => {
        const student = await studentsRepository.findByStudentId(barcode);
        if (!student) {
            return null;
        }
        const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);
        return {
            ...student,
            defaultTimeLimit,
            hasActiveSession: false,
        };
    }, {
        key: `student:barcode:${barcode}`,
        ttl: 300,
        tags: ['student', 'barcode'],
    });
}
async function getStudentById(id) {
    return performanceOptimizationService_1.performanceOptimizationService.executeQuery('student_by_id', async () => {
        const student = await studentsRepository.findById(id);
        if (!student) {
            return null;
        }
        const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);
        return {
            ...student,
            defaultTimeLimit,
            hasActiveSession: false,
        };
    }, {
        key: `student:id:${id}`,
        ttl: 300,
        tags: ['student'],
    });
}
async function getStudents(options = {}) {
    const { gradeCategory, isActive, page = 1, limit = 50 } = options;
    const cacheKey = `students:list:${JSON.stringify({ gradeCategory, isActive, page, limit })}`;
    return performanceOptimizationService_1.performanceOptimizationService.executeQuery('students_list', async () => {
        const queryOptions = {
            page,
            limit,
            sortBy: 'last_name',
            sortOrder: 'asc',
        };
        if (gradeCategory !== undefined) {
            queryOptions.grade_category = gradeCategory;
        }
        if (isActive !== undefined) {
            queryOptions.isActive = isActive;
        }
        const result = await studentsRepository.getStudents(queryOptions);
        return {
            students: result.students,
            total: result.pagination.total,
            pagination: result.pagination,
        };
    }, {
        key: cacheKey,
        ttl: 180,
        tags: ['students', 'list'],
    });
}
async function createStudent(data) {
    try {
        const student = await studentsRepository.createStudent({
            student_id: data.student_id,
            first_name: data.first_name,
            last_name: data.last_name,
            grade_level: data.grade_level,
            grade_category: data.grade_category,
            section: data.section || '',
        });
        return student;
    }
    catch (error) {
        if (error.message === 'Student ID already exists') {
            throw error;
        }
        errorHandler.handleDatabaseError(error, 'createStudent', { data });
        throw error;
    }
}
async function updateStudent(identifier, data) {
    try {
        const isDatabaseId = identifier.length >= 25 && /^[a-z0-9]{25}$/.test(identifier);
        const updateData = {};
        if (data.firstName !== undefined)
            updateData.first_name = data.firstName;
        if (data.lastName !== undefined)
            updateData.last_name = data.lastName;
        if (data.gradeLevel !== undefined)
            updateData.grade_level = data.gradeLevel;
        if (data.gradeCategory !== undefined)
            updateData.grade_category = data.gradeCategory;
        if (data.section !== undefined)
            updateData.section = data.section;
        if (data.isActive !== undefined)
            updateData.is_active = data.isActive;
        let student;
        if (isDatabaseId) {
            student = await studentsRepository.updateById(identifier, updateData);
        }
        else {
            student = await studentsRepository.updateByExternalId(identifier, updateData);
        }
        if (!student) {
            logger_1.logger.warn('Attempted to update non-existent student', { identifier });
            return null;
        }
        logger_1.logger.info('Student updated successfully', { identifier });
        return student;
    }
    catch (error) {
        logger_1.logger.error('Error updating student', {
            error: error.message,
            identifier,
            data,
        });
        throw error;
    }
}
async function deleteStudent(identifier) {
    try {
        const isDatabaseId = identifier.length >= 25 && /^[a-z0-9]{25}$/.test(identifier);
        let success;
        if (isDatabaseId) {
            success = await studentsRepository.deleteById(identifier);
        }
        else {
            success = await studentsRepository.deleteByExternalId(identifier);
        }
        if (!success) {
            logger_1.logger.warn('Attempted to delete non-existent student', { identifier });
            return null;
        }
        logger_1.logger.info('Student deleted successfully', { identifier });
        return { success: true };
    }
    catch (error) {
        logger_1.logger.error('Error deleting student', {
            error: error.message,
            identifier,
        });
        throw error;
    }
}
async function getStudentActivities(options = {}) {
    try {
        const { student_id, startDate, endDate, activityType, status, page = 1, limit = 50, } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (student_id) {
            where.student_id = student_id;
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
        if (activityType) {
            where.activity_type = activityType;
        }
        if (status) {
            where.status = status;
        }
        const [activities, total] = await Promise.all([
            prisma_1.prisma.student_activities.findMany({
                where,
                skip,
                take: limit,
                orderBy: { start_time: 'desc' },
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
        logger_1.logger.error('Error fetching student activities', {
            error: error.message,
            options,
        });
        throw error;
    }
}
async function getActiveSessions() {
    try {
        const activities = await prisma_1.prisma.student_activities.findMany({
            where: { status: client_1.student_activities_status.ACTIVE },
            orderBy: { start_time: 'desc' },
        });
        return activities;
    }
    catch (error) {
        errorHandler.handleDatabaseError(error, 'getActiveSessions', {});
        throw error;
    }
}
async function createStudentActivity(data) {
    try {
        const student = await studentsRepository.findByStudentId(data.student_id);
        if (!student) {
            throw new Error('Student not found');
        }
        const timeLimitMinutes = data.timeLimitMinutes || getDefaultTimeLimit(student.grade_category);
        const startTime = new Date();
        const activity = await prisma_1.prisma.student_activities.create({
            data: {
                id: `activity-${Date.now()}-${student.id}`,
                student_id: student.id,
                student_name: `${student.first_name} ${student.last_name}`.trim(),
                grade_level: student.grade_level,
                grade_category: student.grade_category,
                activity_type: data.activity_type,
                equipment_id: data.equipment_id || null,
                start_time: startTime,
                time_limit_minutes: timeLimitMinutes,
                notes: data.notes || null,
                status: client_1.student_activities_status.ACTIVE,
                processed_by: 'System',
                updated_at: new Date(),
            },
        });
        logger_1.logger.info('Student activity created successfully', {
            activityId: activity.id,
            student_id: student.student_id,
            activity_type: data.activity_type,
        });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error creating student activity', {
            error: error.message,
            data,
        });
        throw error;
    }
}
async function endStudentActivity(activityId) {
    try {
        const now = new Date();
        const activity = await prisma_1.prisma.student_activities.update({
            where: { id: activityId },
            data: {
                end_time: now,
                status: client_1.student_activities_status.COMPLETED,
                updated_at: now,
            },
        });
        if (activity.start_time) {
            if (activity.end_time && activity.start_time) {
                const duration = Math.round((activity.end_time.getTime() - activity.start_time.getTime()) / 60000);
                await prisma_1.prisma.student_activities.update({
                    where: { id: activityId },
                    data: { duration_minutes: duration },
                });
            }
        }
        logger_1.logger.info('Student activity ended successfully', {
            activityId,
            student_id: activity.student_id,
            duration: activity.duration_minutes,
        });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error ending student activity', {
            error: error.message,
            activityId,
        });
        throw error;
    }
}
