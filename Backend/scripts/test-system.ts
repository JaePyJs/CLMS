import { scanStudentBarcode, registerStudent, checkDuplicateScan } from '@/services/scanService';
import { processStudentCheckIn, processStudentCheckOut } from '@/services/scanService';
import { getEquipment } from '@/services/equipmentService';
import { logger } from '@/utils/logger';
import { student_activities_activity_type, students_grade_category } from '@prisma/client';

async function testSystem() {
  try {
    logger.info('Testing CLMS system functionality...');

    // Test 1: Check configured stations
    logger.info('Test 1: Checking configured stations...');
    const equipment = await getEquipment({ limit: 20 });
    logger.info(`Found ${equipment.equipment.length} stations:`, {
      stations: equipment.equipment.map(eq => ({
        id: eq.equipment_id,
        name: eq.name,
        type: eq.type,
        location: eq.location
      }))
    });

    // Test 2: Test student registration
    logger.info('Test 2: Testing student registration...');
    const timestamp = Date.now();
    const testStudent = {
      student_id: `TEST${timestamp}`,
      first_name: 'Test',
      last_name: 'Student',
      grade_level: '10',
      grade_category: students_grade_category.JUNIOR_HIGH,
      section: 'A'
    };

    const registeredStudent = await registerStudent(testStudent);
    logger.info('Student registered successfully:', {
      id: registeredStudent.student_id,
      name: `${registeredStudent.first_name} ${registeredStudent.last_name}`
    });

    // Test 3: Test barcode scanning for new student
    logger.info('Test 3: Testing barcode scan for new student...');
    const scanResult = await scanStudentBarcode(testStudent.student_id);
    logger.info('Scan result:', {
      type: scanResult.type,
      message: scanResult.message,
      requiresRegistration: scanResult.data.requiresRegistration,
      isDuplicate: scanResult.data.isDuplicate
    });

    // Test 4: Test self-service check-in
    logger.info('Test 4: Testing self-service check-in...');
    const checkInResult = await processStudentCheckIn(
      testStudent.student_id,
      student_activities_activity_type.GENERAL_VISIT
    );
    logger.info('Check-in successful:', {
      activityId: checkInResult.id,
      student_id: checkInResult.student_id,
      activity_type: checkInResult.activity_type,
      status: checkInResult.status
    });

    // Test 5: Test duplicate scan detection
    logger.info('Test 5: Testing duplicate scan detection...');
    const isDuplicate = await checkDuplicateScan(testStudent.student_id);
    logger.info('Duplicate scan check:', { isDuplicate });

    // Test 6: Test self-service check-out
    logger.info('Test 6: Testing self-service check-out...');
    const checkOutResult = await processStudentCheckOut(testStudent.student_id);
    logger.info('Check-out successful:', {
      activityId: checkOutResult.id,
      student_id: checkOutResult.student_id,
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