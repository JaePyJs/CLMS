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
function getDefaultTimeLimit(gradeCategory) {
    const timeLimits = {
        PRIMARY: parseInt(process.env.PRIMARY_TIME_LIMIT || '30'),
        GRADE_SCHOOL: parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT || '60'),
        JUNIOR_HIGH: parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT || '90'),
        SENIOR_HIGH: parseInt(process.env.SENIOR_HIGH_TIME_LIMIT || '120'),
    };
    return timeLimits[gradeCategory] || 60;
}
async function getStudentByBarcode(barcode) {
    try {
        const student = await prisma_1.prisma.student.findUnique({
            where: { studentId: barcode },
            include: {
                activities: {
                    where: { status: client_1.ActivityStatus.ACTIVE },
                    orderBy: { startTime: 'desc' },
                    take: 1,
                },
            },
        });
        if (!student) {
            return null;
        }
        const defaultTimeLimit = getDefaultTimeLimit(student.gradeCategory);
        return {
            ...student,
            defaultTimeLimit,
            hasActiveSession: student.activities.length > 0,
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching student by barcode', {
            error: error.message,
            barcode,
        });
        throw error;
    }
}
async function getStudentById(id) {
    try {
        const student = await prisma_1.prisma.student.findUnique({
            where: { id },
            include: {
                activities: {
                    where: { status: client_1.ActivityStatus.ACTIVE },
                    orderBy: { startTime: 'desc' },
                    take: 1,
                },
            },
        });
        if (!student) {
            return null;
        }
        const defaultTimeLimit = getDefaultTimeLimit(student.gradeCategory);
        return {
            ...student,
            defaultTimeLimit,
            hasActiveSession: student.activities.length > 0,
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching student by ID', {
            error: error.message,
            id,
        });
        throw error;
    }
}
async function getStudents(options = {}) {
    try {
        const { gradeCategory, isActive, page = 1, limit = 50 } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (gradeCategory) {
            where.gradeCategory = gradeCategory;
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }
        const [students, total] = await Promise.all([
            prisma_1.prisma.student.findMany({
                where,
                skip,
                take: limit,
                orderBy: { lastName: 'asc' },
            }),
            prisma_1.prisma.student.count({ where }),
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
    }
    catch (error) {
        logger_1.logger.error('Error fetching students', {
            error: error.message,
            options,
        });
        throw error;
    }
}
async function createStudent(data) {
    try {
        const existing = await prisma_1.prisma.student.findUnique({
            where: { studentId: data.studentId },
        });
        if (existing) {
            logger_1.logger.warn('Attempted to create duplicate student', {
                studentId: data.studentId,
            });
            throw new Error('Student ID already exists');
        }
        const student = await prisma_1.prisma.student.create({
            data,
        });
        logger_1.logger.info('Student created successfully', {
            studentId: student.studentId,
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
            : { studentId: identifier };
        const existing = await prisma_1.prisma.student.findUnique({
            where: whereClause,
        });
        if (!existing) {
            logger_1.logger.warn('Attempted to update non-existent student', { identifier });
            return null;
        }
        const student = await prisma_1.prisma.student.update({
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
            : { studentId: identifier };
        const existing = await prisma_1.prisma.student.findUnique({
            where: whereClause,
        });
        if (!existing) {
            logger_1.logger.warn('Attempted to delete non-existent student', { identifier });
            return null;
        }
        const student = await prisma_1.prisma.student.delete({
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
        const { studentId, startDate, endDate, activityType, status, page = 1, limit = 50, } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (studentId) {
            where.studentId = studentId;
        }
        if (startDate || endDate) {
            const startTimeFilter = {};
            if (startDate) {
                startTimeFilter.gte = startDate;
            }
            if (endDate) {
                startTimeFilter.lte = endDate;
            }
            where.startTime = startTimeFilter;
        }
        if (activityType) {
            where.activityType = activityType;
        }
        if (status) {
            where.status = status;
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
        logger_1.logger.error('Error fetching student activities', {
            error: error.message,
            options,
        });
        throw error;
    }
}
async function getActiveSessions() {
    try {
        const activities = await prisma_1.prisma.activity.findMany({
            where: { status: client_1.ActivityStatus.ACTIVE },
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
        const student = await prisma_1.prisma.student.findUnique({
            where: { studentId: data.studentId },
        });
        if (!student) {
            throw new Error('Student not found');
        }
        const timeLimitMinutes = data.timeLimitMinutes || getDefaultTimeLimit(student.gradeCategory);
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + timeLimitMinutes * 60000);
        const activity = await prisma_1.prisma.activity.create({
            data: {
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`.trim(),
                studentGradeLevel: student.gradeLevel,
                studentGradeCategory: student.gradeCategory,
                activityType: data.activityType,
                equipmentId: data.equipmentId || null,
                startTime,
                endTime,
                timeLimitMinutes,
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
        logger_1.logger.info('Student activity created successfully', {
            activityId: activity.id,
            studentId: student.studentId,
            activityType: data.activityType,
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
        const activity = await prisma_1.prisma.activity.update({
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
            },
        });
        if (activity.startTime) {
            const duration = Math.floor((now.getTime() - activity.startTime.getTime()) / 60000);
            await prisma_1.prisma.activity.update({
                where: { id: activityId },
                data: { durationMinutes: duration },
            });
        }
        logger_1.logger.info('Student activity ended successfully', {
            activityId,
            studentId: activity.student.studentId,
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