"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
async function scanBarcode(barcode) {
    try {
        if (/^\d+$/.test(barcode)) {
            const student = await (0, studentService_1.getStudentByBarcode)(barcode);
            if (student) {
                return {
                    type: 'student',
                    data: student,
                    message: 'Student found successfully',
                    timestamp: new Date().toISOString()
                };
            }
        }
        const bookByAccession = await (0, bookService_1.getBookByAccessionNo)(barcode);
        if (bookByAccession) {
            return {
                type: 'book',
                data: bookByAccession,
                message: 'Book found successfully',
                timestamp: new Date().toISOString()
            };
        }
        const bookByIsbn = await (0, bookService_1.getBookByIsbn)(barcode);
        if (bookByIsbn) {
            return {
                type: 'book',
                data: bookByIsbn,
                message: 'Book found successfully',
                timestamp: new Date().toISOString()
            };
        }
        const equipment = await (0, equipmentService_1.getEquipmentByEquipmentId)(barcode);
        if (equipment) {
            return {
                type: 'equipment',
                data: equipment,
                message: 'Equipment found successfully',
                timestamp: new Date().toISOString()
            };
        }
        return {
            type: 'unknown',
            data: null,
            message: 'No matching entity found for this barcode',
            timestamp: new Date().toISOString()
        };
    }
    catch (error) {
        logger_1.logger.error('Error scanning barcode', { error: error.message, barcode });
        return {
            type: 'unknown',
            data: null,
            message: 'Error scanning barcode',
            timestamp: new Date().toISOString()
        };
    }
}
async function processStudentCheckIn(studentId, activityType, notes) {
    try {
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const existingSession = activeSessions.find(session => session.student.studentId === studentId);
        if (existingSession) {
            await (0, studentService_1.endStudentActivity)(existingSession.id);
            logger_1.logger.info('Student check-out processed', { studentId, activityId: existingSession.id });
        }
        const activityData = {
            studentId,
            activityType
        };
        if (notes) {
            activityData.notes = notes;
        }
        const activity = await (0, studentService_1.createStudentActivity)(activityData);
        logger_1.logger.info('Student check-in processed', { studentId, activityId: activity.id });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error processing student check-in', { error: error.message, studentId, activityType });
        throw error;
    }
}
async function processStudentCheckOut(studentId) {
    try {
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const existingSession = activeSessions.find(session => session.student.studentId === studentId);
        if (!existingSession) {
            throw new Error('No active session found for this student');
        }
        const activity = await (0, studentService_1.endStudentActivity)(existingSession.id);
        logger_1.logger.info('Student check-out processed', { studentId, activityId: activity.id });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error processing student check-out', { error: error.message, studentId });
        throw error;
    }
}
async function processBookCheckout(bookId, studentId, dueDate, notes) {
    try {
        const activeCheckouts = await (0, bookService_1.getBookCheckouts)({
            bookId,
            studentId,
            status: client_1.CheckoutStatus.ACTIVE
        });
        if (activeCheckouts.checkouts.length > 0) {
            throw new Error('Student has already checked out this book');
        }
        const checkoutData = {
            bookId,
            studentId,
            dueDate
        };
        if (notes) {
            checkoutData.notes = notes;
        }
        const checkout = await (0, bookService_1.checkoutBook)(checkoutData);
        logger_1.logger.info('Book checkout processed', { bookId, studentId, checkoutId: checkout.id });
        return checkout;
    }
    catch (error) {
        logger_1.logger.error('Error processing book checkout', { error: error.message, bookId, studentId });
        throw error;
    }
}
async function processBookReturn(checkoutId) {
    try {
        const checkout = await (0, bookService_1.returnBook)(checkoutId);
        logger_1.logger.info('Book return processed', { checkoutId });
        return checkout;
    }
    catch (error) {
        logger_1.logger.error('Error processing book return', { error: error.message, checkoutId });
        throw error;
    }
}
async function processEquipmentUse(equipmentId, studentId, activityType, notes) {
    try {
        const activityData = {
            equipmentId,
            studentId,
            activityType
        };
        if (notes) {
            activityData.notes = notes;
        }
        const activity = await (0, equipmentService_1.useEquipment)(activityData);
        logger_1.logger.info('Equipment use processed', { equipmentId, studentId, activityId: activity.id });
        return activity;
    }
    catch (error) {
        logger_1.logger.error('Error processing equipment use', { error: error.message, equipmentId, studentId });
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
        logger_1.logger.error('Error processing equipment release', { error: error.message, activityId });
        throw error;
    }
}
async function getStudentStatus(studentId) {
    try {
        const student = await (0, studentService_1.getStudentByBarcode)(studentId);
        if (!student) {
            throw new Error('Student not found');
        }
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const studentActiveSession = activeSessions.find(session => session.student.studentId === studentId);
        const activeCheckouts = await (0, bookService_1.getBookCheckouts)({
            studentId,
            status: client_1.CheckoutStatus.ACTIVE
        });
        const equipmentUsage = await (0, bookService_1.getBookCheckouts)({
            studentId,
            status: client_1.ActivityStatus.ACTIVE
        });
        return {
            student,
            hasActiveSession: !!studentActiveSession,
            activeSession: studentActiveSession || null,
            activeBookCheckouts: activeCheckouts.checkouts.length,
            activeBookCheckoutsData: activeCheckouts.checkouts,
            equipmentUsage: equipmentUsage.checkouts.length,
            equipmentUsageData: equipmentUsage.checkouts
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting student status', { error: error.message, studentId });
        throw error;
    }
}
async function getBookStatus(bookId) {
    try {
        const book = await (0, bookService_1.getBookById)(bookId);
        if (!book) {
            throw new Error('Book not found');
        }
        const activeCheckouts = await (0, bookService_1.getBookCheckouts)({
            bookId,
            status: client_1.CheckoutStatus.ACTIVE
        });
        return {
            book,
            isAvailable: book.availableCopies > 0,
            activeCheckout: activeCheckouts.checkouts.length > 0 ? activeCheckouts.checkouts[0] : null
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting book status', { error: error.message, bookId });
        throw error;
    }
}
async function getEquipmentStatus(equipmentId) {
    try {
        const equipment = await (0, equipmentService_1.getEquipmentById)(equipmentId);
        if (!equipment) {
            throw new Error('Equipment not found');
        }
        const activeSessions = await (0, studentService_1.getActiveSessions)();
        const equipmentActiveSession = activeSessions.find(session => session.equipment && session.equipment.equipmentId === equipment.equipmentId);
        return {
            equipment,
            isAvailable: equipment.status === 'AVAILABLE',
            activeSession: equipmentActiveSession || null
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting equipment status', { error: error.message, equipmentId });
        throw error;
    }
}
//# sourceMappingURL=scanService.js.map