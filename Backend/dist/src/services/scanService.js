"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStudent = registerStudent;
exports.checkDuplicateScan = checkDuplicateScan;
exports.scanStudentBarcode = scanStudentBarcode;
exports.scanBarcode = scanBarcode;
exports.processStudentCheckIn = processStudentCheckIn;
exports.processStudentCheckOut = processStudentCheckOut;
exports.processBookCheckout = processBookCheckout;
exports.processBookReturn = processBookReturn;
exports.processEquipmentUse = processEquipmentUse;
exports.processEquipmentRelease = processEquipmentRelease;
exports.getStudentStatus = getStudentStatus;
exports.getBookStatus = getBookStatus;
exports.getEquipmentStatus = getEquipmentStatus;
const studentService_1 = require("./studentService");
const bookService_1 = require("./bookService");
const equipmentService_1 = require("./equipmentService");
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
const prisma_1 = require("@/utils/prisma");
async function registerStudent(registrationData) {
    try {
        const student = await (0, studentService_1.createStudent)(registrationData);
        logger_1.logger.info('Student registered successfully', {
            student_id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
        });
        return student;
    }
    catch (error) {
        logger_1.logger.error('Error registering student', {
            error: error.message,
            registrationData,
        });
        throw error;
    }
}
async function checkDuplicateScan(student_id) {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const recentActivities = await prisma_1.prisma.student_activities.findMany({
            where: {
                student_id,
                activity_type: client_1.student_activities_activity_type.GENERAL_VISIT,
                start_time: {
                    gte: thirtyMinutesAgo,
                },
                status: client_1.student_activities_status.ACTIVE,
            },
        });
        return recentActivities.length > 0;
    }
    catch (error) {
        logger_1.logger.error('Error checking duplicate scan', {
            error: error.message,
            student_id,
        });
        return false;
    }
}
async function scanStudentBarcode(student_id) {
    try {
        const student = await (0, studentService_1.getStudentByBarcode)(student_id);
        if (!student) {
            return {
                type: 'student',
                data: { id: crypto.randomUUID(), updated_at: new Date(),
                    requiresRegistration: true,
                    student: null,
                },
                message: 'Student not found. Registration required.',
                timestamp: new Date().toISOString(),
                requiresRegistration: true,
            };
        }
        const isDuplicate = await checkDuplicateScan(student_id);
        if (isDuplicate) {
            return {
                type: 'student',
                data: { id: crypto.randomUUID(), updated_at: new Date(),
                    student,
                    isDuplicate: true,
                    canCheckOut: true,
                },
                message: 'Duplicate scan detected within 30 minutes. You can check out if needed.',
                timestamp: new Date().toISOString(),
                isDuplicate: true,
                canCheckOut: true,
            };
        }
        const hasActiveSession = student.hasActiveSession;
        return {
            type: 'student',
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                student,
                isDuplicate: false,
                canCheckOut: hasActiveSession,
            },
            message: hasActiveSession
                ? 'Student found with active session. Ready for check-out.'
                : 'Student found. Ready for check-in.',
            timestamp: new Date().toISOString(),
            canCheckOut: hasActiveSession,
        };
    }
    catch (error) {
        logger_1.logger.error('Error scanning student barcode', {
            error: error.message,
            student_id,
        });
        return {
            type: 'student',
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                student: null,
                requiresRegistration: false,
                isDuplicate: false,
                canCheckOut: false,
            },
            message: 'Error scanning student barcode',
            timestamp: new Date().toISOString(),
        };
    }
}
async function scanBarcode(barcode) {
    try {
        if (/^\d+$/.test(barcode)) {
            return await scanStudentBarcode(barcode);
        }
        const bookByAccession = await (0, bookService_1.getBookByAccessionNo)(barcode);
        if (bookByAccession) {
            return {
                type: 'book',
                data: bookByAccession,
                message: 'Book found successfully',
                timestamp: new Date().toISOString(),
            };
        }
        const bookByIsbn = await (0, bookService_1.getBookByIsbn)(barcode);
        if (bookByIsbn) {
            return {
                type: 'book',
                data: bookByIsbn,
                message: 'Book found successfully',
                timestamp: new Date().toISOString(),
            };
        }
        const equipment = await (0, equipmentService_1.getEquipmentByEquipmentId)(barcode);
        if (equipment) {
            return {
                type: 'equipment',
                data: equipment,
                message: 'Equipment found successfully',
                timestamp: new Date().toISOString(),
            };
        }
        return {
            type: 'unknown',
            data: null,
            message: 'No matching entity found for this barcode',
            timestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        logger_1.logger.error('Error scanning barcode', {
            error: error.message,
            barcode,
        });
        return {
            type: 'unknown',
            data: null,
            message: 'Error scanning barcode',
            timestamp: new Date().toISOString(),
        };
    }
}
async function processStudentCheckIn(student_id, activity_type, notes) {
    try {
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const existingSession = activeSessions.find(session => session.student?.student_id === student_id);
        if (existingSession) {
            await (0, studentService_1.endStudentActivity)(existingSession.id);
            logger_1.logger.info('Student check-out processed', {
                student_id,
                activityId: existingSession.id,
            });
        }
        const activityData = {
            student_id,
            activity_type,
        };
        if (notes) {
            activityData.notes = notes;
        }
        const activity = await (0, studentService_1.createStudentActivity)(activityData);
        logger_1.logger.info('Student check-in processed', {
            student_id,
            activityId: activity.id,
        });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error processing student check-in', {
            error: error.message,
            student_id,
            activity_type,
        });
        throw error;
    }
}
async function processStudentCheckOut(student_id) {
    try {
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const existingSession = activeSessions.find(session => session.student?.student_id === student_id);
        if (!existingSession) {
            throw new Error('No active session found for this student');
        }
        const activity = await (0, studentService_1.endStudentActivity)(existingSession.id);
        logger_1.logger.info('Student check-out processed', {
            student_id,
            activityId: activity.id,
        });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error processing student check-out', {
            error: error.message,
            student_id,
        });
        throw error;
    }
}
async function processBookCheckout(book_id, student_id, due_date, notes) {
    try {
        const activeCheckouts = await (0, bookService_1.getBookCheckouts)({
            book_id,
            student_id,
            status: client_1.book_checkouts_status.ACTIVE,
        });
        if (activeCheckouts.checkouts.length > 0) {
            throw new Error('Student has already checked out this book');
        }
        const checkoutData = {
            book_id,
            student_id,
            due_date,
        };
        if (notes) {
            checkoutData.notes = notes;
        }
        const checkout = await (0, bookService_1.checkoutBook)(checkoutData);
        logger_1.logger.info('Book checkout processed', {
            book_id,
            student_id,
            checkout_id: checkout.id,
        });
        return checkout;
    }
    catch (error) {
        logger_1.logger.error('Error processing book checkout', {
            error: error.message,
            book_id,
            student_id,
        });
        throw error;
    }
}
async function processBookReturn(checkout_id) {
    try {
        const checkout = await (0, bookService_1.returnBook)(checkoutId);
        logger_1.logger.info('Book return processed', { checkout_id });
        return checkout;
    }
    catch (error) {
        logger_1.logger.error('Error processing book return', {
            error: error.message,
            checkout_id,
        });
        throw error;
    }
}
async function processEquipmentUse(equipment_id, student_id, activity_type, notes) {
    try {
        const activityData = {
            equipment_id,
            student_id,
            activity_type,
        };
        if (notes) {
            activityData.notes = notes;
        }
        const activity = await (0, equipmentService_1.useEquipment)(activityData);
        logger_1.logger.info('Equipment use processed', {
            equipment_id,
            student_id,
            activityId: activity.id,
        });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error processing equipment use', {
            error: error.message,
            equipment_id,
            student_id,
        });
        throw error;
    }
}
async function processEquipmentRelease(activityId) {
    try {
        const activity = await (0, equipmentService_1.releaseEquipment)(activityId);
        logger_1.logger.info('Equipment release processed', { activityId });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error processing equipment release', {
            error: error.message,
            activityId,
        });
        throw error;
    }
}
async function getStudentStatus(student_id) {
    try {
        const student = await (0, studentService_1.getStudentByBarcode)(student_id);
        if (!student) {
            throw new Error('Student not found');
        }
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const studentActiveSession = activeSessions.find(session => session.student.student_id === student_id);
        const activeCheckouts = await (0, bookService_1.getBookCheckouts)({
            student_id,
            status: client_1.book_checkouts_status.ACTIVE,
        });
        const equipmentUsage = await (0, bookService_1.getBookCheckouts)({
            student_id,
            status: client_1.student_activities_status.ACTIVE,
        });
        return {
            student,
            hasActiveSession: !!studentActiveSession,
            activeSession: studentActiveSession || null,
            activeBookCheckouts: activeCheckouts.checkouts.length,
            activeBookCheckoutsData: activeCheckouts.checkouts,
            equipmentUsage: equipmentUsage.checkouts.length,
            equipmentUsageData: equipmentUsage.checkouts,
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting student status', {
            error: error.message,
            student_id,
        });
        throw error;
    }
}
async function getBookStatus(book_id) {
    try {
        const book = await (0, bookService_1.getBookById)(book_id);
        if (!book) {
            throw new Error('Book not found');
        }
        const activeCheckouts = await (0, bookService_1.getBookCheckouts)({
            book_id,
            status: client_1.book_checkouts_status.ACTIVE,
        });
        return {
            book,
            isAvailable: book.available_copies > 0,
            activeCheckout: activeCheckouts.checkouts.length > 0
                ? activeCheckouts.checkouts[0]
                : null,
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting book status', {
            error: error.message,
            book_id,
        });
        throw error;
    }
}
async function getEquipmentStatus(equipment_id) {
    try {
        const equipment = await (0, equipmentService_1.getEquipmentById)(equipment_id);
        if (!equipment) {
            throw new Error('Equipment not found');
        }
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const equipmentActiveSession = activeSessions.find(session => session.equipment &&
            session.equipment.equipment_id === equipment.equipment_id);
        return {
            equipment,
            isAvailable: equipment.status === 'AVAILABLE',
            activeSession: equipmentActiveSession || null,
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting equipment status', {
            error: error.message,
            equipment_id,
        });
        throw error;
    }
}
