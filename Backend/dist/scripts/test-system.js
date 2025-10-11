"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSystem = testSystem;
const scanService_1 = require("@/services/scanService");
const scanService_2 = require("@/services/scanService");
const equipmentService_1 = require("@/services/equipmentService");
const logger_1 = require("@/utils/logger");
const client_1 = require("@prisma/client");
async function testSystem() {
    try {
        logger_1.logger.info('Testing CLMS system functionality...');
        logger_1.logger.info('Test 1: Checking configured stations...');
        const equipment = await (0, equipmentService_1.getEquipment)({ limit: 20 });
        logger_1.logger.info(`Found ${equipment.equipment.length} stations:`, {
            stations: equipment.equipment.map(eq => ({
                id: eq.equipmentId,
                name: eq.name,
                type: eq.type,
                location: eq.location
            }))
        });
        logger_1.logger.info('Test 2: Testing student registration...');
        const timestamp = Date.now();
        const testStudent = {
            studentId: `TEST${timestamp}`,
            firstName: 'Test',
            lastName: 'Student',
            gradeLevel: '10',
            gradeCategory: client_1.GradeCategory.JUNIOR_HIGH,
            section: 'A'
        };
        const registeredStudent = await (0, scanService_1.registerStudent)(testStudent);
        logger_1.logger.info('Student registered successfully:', {
            id: registeredStudent.studentId,
            name: `${registeredStudent.firstName} ${registeredStudent.lastName}`
        });
        logger_1.logger.info('Test 3: Testing barcode scan for new student...');
        const scanResult = await (0, scanService_1.scanStudentBarcode)(testStudent.studentId);
        logger_1.logger.info('Scan result:', {
            type: scanResult.type,
            message: scanResult.message,
            requiresRegistration: scanResult.data.requiresRegistration,
            isDuplicate: scanResult.data.isDuplicate
        });
        logger_1.logger.info('Test 4: Testing self-service check-in...');
        const checkInResult = await (0, scanService_2.processStudentCheckIn)(testStudent.studentId, client_1.ActivityType.GENERAL_VISIT);
        logger_1.logger.info('Check-in successful:', {
            activityId: checkInResult.id,
            studentId: checkInResult.studentId,
            activityType: checkInResult.activityType,
            status: checkInResult.status
        });
        logger_1.logger.info('Test 5: Testing duplicate scan detection...');
        const isDuplicate = await (0, scanService_1.checkDuplicateScan)(testStudent.studentId);
        logger_1.logger.info('Duplicate scan check:', { isDuplicate });
        logger_1.logger.info('Test 6: Testing self-service check-out...');
        const checkOutResult = await (0, scanService_2.processStudentCheckOut)(testStudent.studentId);
        logger_1.logger.info('Check-out successful:', {
            activityId: checkOutResult.id,
            studentId: checkOutResult.studentId,
            status: checkOutResult.status
        });
        logger_1.logger.info('All tests completed successfully!');
    }
    catch (error) {
        logger_1.logger.error('Test failed:', { error: error.message });
        throw error;
    }
}
if (require.main === module) {
    testSystem()
        .then(() => {
        logger_1.logger.info('System test script completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('System test script failed', { error: error.message });
        process.exit(1);
    });
}
//# sourceMappingURL=test-system.js.map