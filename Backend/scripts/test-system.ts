import { scanStudentBarcode, registerStudent, checkDuplicateScan } from '@/services/scanService';
import { processStudentCheckIn, processStudentCheckOut } from '@/services/scanService';
import { getEquipment } from '@/services/equipmentService';
import { logger } from '@/utils/logger';
import { ActivityType, GradeCategory } from '@prisma/client';

async function testSystem() {
  try {
    logger.info('Testing CLMS system functionality...');

    // Test 1: Check configured stations
    logger.info('Test 1: Checking configured stations...');
    const equipment = await getEquipment({ limit: 20 });
    logger.info(`Found ${equipment.equipment.length} stations:`, {
      stations: equipment.equipment.map(eq => ({
        id: eq.equipmentId,
        name: eq.name,
        type: eq.type,
        location: eq.location
      }))
    });

    // Test 2: Test student registration
    logger.info('Test 2: Testing student registration...');
    const timestamp = Date.now();
    const testStudent = {
      studentId: `TEST${timestamp}`,
      firstName: 'Test',
      lastName: 'Student',
      gradeLevel: '10',
      gradeCategory: GradeCategory.JUNIOR_HIGH,
      section: 'A'
    };

    const registeredStudent = await registerStudent(testStudent);
    logger.info('Student registered successfully:', {
      id: registeredStudent.studentId,
      name: `${registeredStudent.firstName} ${registeredStudent.lastName}`
    });

    // Test 3: Test barcode scanning for new student
    logger.info('Test 3: Testing barcode scan for new student...');
    const scanResult = await scanStudentBarcode(testStudent.studentId);
    logger.info('Scan result:', {
      type: scanResult.type,
      message: scanResult.message,
      requiresRegistration: scanResult.data.requiresRegistration,
      isDuplicate: scanResult.data.isDuplicate
    });

    // Test 4: Test self-service check-in
    logger.info('Test 4: Testing self-service check-in...');
    const checkInResult = await processStudentCheckIn(
      testStudent.studentId,
      ActivityType.GENERAL_VISIT
    );
    logger.info('Check-in successful:', {
      activityId: checkInResult.id,
      studentId: checkInResult.studentId,
      activityType: checkInResult.activityType,
      status: checkInResult.status
    });

    // Test 5: Test duplicate scan detection
    logger.info('Test 5: Testing duplicate scan detection...');
    const isDuplicate = await checkDuplicateScan(testStudent.studentId);
    logger.info('Duplicate scan check:', { isDuplicate });

    // Test 6: Test self-service check-out
    logger.info('Test 6: Testing self-service check-out...');
    const checkOutResult = await processStudentCheckOut(testStudent.studentId);
    logger.info('Check-out successful:', {
      activityId: checkOutResult.id,
      studentId: checkOutResult.studentId,
      status: checkOutResult.status
    });

    logger.info('All tests completed successfully!');
  } catch (error) {
    logger.error('Test failed:', { error: (error as Error).message });
    throw error;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testSystem()
    .then(() => {
      logger.info('System test script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('System test script failed', { error: (error as Error).message });
      process.exit(1);
    });
}

export { testSystem };