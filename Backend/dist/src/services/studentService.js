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
const prisma_1 = require("@/utils/prisma");
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
const performanceOptimizationService_1 = require("./performanceOptimizationService");
function getDefaultTimeLimit(grade_category) {
    const timeLimits = {
        PRIMARY: parseInt(process.env.PRIMARY_TIME_LIMIT || '30'),
        GRADE_SCHOOL: parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT || '60'),
        JUNIOR_HIGH: parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT || '90'),
        SENIOR_HIGH: parseInt(process.env.SENIOR_HIGH_TIME_LIMIT || '120'),
    };
    return timeLimits[gradeCategory] || 60;
}
async function getStudentByBarcode(barcode) {
    return performanceOptimizationService_1.performanceOptimizationService.executeQuery('student_by_barcode', async () => {
        const student = await prisma_1.prisma.students.findUnique({
            where: { student_id: barcode },
            include: {
                activities: {
                    where: { status: client_1.student_activities_status.ACTIVE },
                    orderBy: { start_time: 'desc' },
                    take: 1,
                },
            },
        });
        if (!student) {
            return null;
        }
        const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);
        return {
            ...student,
            defaultTimeLimit,
            hasActiveSession: student.activities.length > 0,
        };
    }, {
        key: `student:barcode:${barcode}`,
        ttl: 300,
        tags: ['student', 'barcode'],
    });
}
async function getStudentById(id) {
    return performanceOptimizationService_1.performanceOptimizationService.executeQuery('student_by_id', async () => {
        const student = await prisma_1.prisma.students.findUnique({
            where: { id },
            include: {
                activities: {
                    where: { status: client_1.student_activities_status.ACTIVE },
                    orderBy: { start_time: 'desc' },
                    take: 1,
                },
            },
        });
        if (!student) {
            return null;
        }
        const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);
        return {
            ...student,
            defaultTimeLimit,
            hasActiveSession: student.activities.length > 0,
        };
    }, {
        key: `student:id:${id}`,
        ttl: 300,
        tags: ['student'],
    });
}
async function getStudents(options = {}) {
    const { grade_category, is_active, page = 1, limit = 50 } = options;
    const cacheKey = `students:list:${JSON.stringify({ grade_category, is_active, page, limit })}`;
    return performanceOptimizationService_1.performanceOptimizationService.executeQuery('students_list', async () => {
        const skip = (page - 1) * limit;
        const where = {};
        if (grade_category) {
            where.grade_category = grade_category;
        }
        if (isActive !== undefined) {
            where.is_active = isActive;
        }
        const [students, total] = await Promise.all([
            prisma_1.prisma.students.findMany({
                where,
                skip,
                take: limit,
                orderBy: { last_name: 'asc' },
            }),
            prisma_1.prisma.students.count({ where }),
        ]);
        return {
            students,
            total,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }, {
        key: cacheKey,
        ttl: 180,
        tags: ['students', 'list'],
    });
}
async function createStudent(data) {
    try {
        const existing = await prisma_1.prisma.students.findUnique({
            where: { student_id: data.student_id },
        });
        if (existing) {
            logger_1.logger.warn('Attempted to create duplicate student', {
                student_id: data.student_id,
            });
            throw new Error('Student ID already exists');
        }
        const student = await prisma_1.prisma.students.create({
            data,
        });
        logger_1.logger.info('Student created successfully', {
            student_id: student.student_id,
        });
        return student;
    }
    catch (error) {
        if (error.message === 'Student ID already exists') {
            throw error;
        }
        logger_1.logger.error('Error creating student', {
            error: error.message,
            data,
        });
        throw error;
    }
}
async function updateStudent(identifier, data) {
    try {
        const isDatabaseId = identifier.length >= 25 && /^[a-z0-9]{25}$/.test(identifier);
        const whereClause = isDatabaseId
            ? { id: identifier }
            : { student_id: identifier };
        const existing = await prisma_1.prisma.students.findUnique({
            where: whereClause,
        });
        if (!existing) {
            logger_1.logger.warn('Attempted to update non-existent student', { identifier });
            return null;
        }
        const student = await prisma_1.prisma.students.update({
            where: whereClause,
            data,
        });
        logger_1.logger.info('Student updated successfully', { identifier });
        return student;
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025') {
            return null;
        }
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
        const whereClause = isDatabaseId
            ? { id: identifier }
            : { student_id: identifier };
        const existing = await prisma_1.prisma.students.findUnique({
            where: whereClause,
        });
        if (!existing) {
            logger_1.logger.warn('Attempted to delete non-existent student', { identifier });
            return null;
        }
        const student = await prisma_1.prisma.students.delete({
            where: whereClause,
        });
        logger_1.logger.info('Student deleted successfully', { identifier });
        return student;
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025') {
            return null;
        }
        logger_1.logger.error('Error deleting student', {
            error: error.message,
            identifier,
        });
        throw error;
    }
}
async function getStudentActivities(options = {}) {
    try {
        const { student_id, startDate, endDate, activity_type, status, page = 1, limit = 50, } = options;
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
                include: {
                    student: {
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
            include: {
                student: {
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
                    },
                },
            },
        });
        return activities;
    }
    catch (error) {
        logger_1.logger.error('Error fetching active sessions', {
            error: error.message,
        });
        throw error;
    }
}
async function createStudentActivity(data) {
    try {
        const student = await prisma_1.prisma.students.findUnique({
            where: { student_id: data.student_id },
        });
        if (!student) {
            throw new Error('Student not found');
        }
        const timeLimitMinutes = data.time_limit_minutes || getDefaultTimeLimit(student.grade_category);
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + timeLimitMinutes * 60000);
        const activity = await prisma_1.prisma.student_activities.create({
            data: {
                student_id: student.id,
                student_name: `${student.first_name} ${student.last_name}`.trim(),
                studentGradeLevel: student.grade_level,
                studentGradeCategory: student.grade_category,
                activity_type: data.activity_type,
                equipment_id: data.equipment_id || null,
                start_time,
                end_time,
                time_limit_minutes,
                notes: data.notes || null,
                status: client_1.student_activities_status.ACTIVE,
                processed_by: 'System',
            },
            include: {
                student: {
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
                    },
                },
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
            },
            include: {
                student: {
                    select: {
                        student_id: true,
                        first_name: true,
                        last_name: true,
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
        logger_1.logger.info('Student activity ended successfully', {
            activityId,
            student_id: activity.student.student_id,
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
//# sourceMappingURL=studentService.js.map