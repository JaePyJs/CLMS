import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { ProcessedAttendanceRecord } from '../services/googleSheetsService';
import { LeaderboardService } from '../services/LeaderboardService';
import { logger } from '../utils/logger';

export class AttendanceRepository {
  private static instance: AttendanceRepository;

  private constructor() {}

  public static getInstance(): AttendanceRepository {
    if (!AttendanceRepository.instance) {
      AttendanceRepository.instance = new AttendanceRepository();
    }
    return AttendanceRepository.instance;
  }

  /**
   * Bulk insert activities.
   * Handles linking to existing students if possible, or creates basic records.
   * Note: This assumes students exist or we have logic to handle non-existent students.
   * For this implementation, we'll skip records where student doesn't exist to maintain referential integrity,
   * or we could allow undefined student connection if the schema allows it (it usually requires a valid student_id).
   */
  public async bulkInsertActivities(
    activities: ProcessedAttendanceRecord[],
  ): Promise<{
    insertedCount: number;
    updatedCount: number;
    skippedStudentNotFound: number;
    unmatchedStudentIds: string[];
  }> {
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedStudentNotFound = 0;
    const unmatchedStudentIds = new Set<string>();
    const batchSize = 25; // Reduced from 50 to prevent transaction timeout

    // Track successful imports for leaderboard update
    const successfulImports: { studentDbId: string; timestamp: Date }[] = [];

    logger.info(
      `[AttendanceImport] Starting import of ${activities.length} activities`,
    );

    // Log first few student IDs we're looking for
    const sampleIds = activities.slice(0, 5).map(a => a.studentId);
    logger.info(
      `[AttendanceImport] Sample student IDs from sheet: ${JSON.stringify(sampleIds)}`,
    );

    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      logger.info(
        `[AttendanceImport] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activities.length / batchSize)}, size: ${batch.length}`,
      );

      // Use extended transaction timeout (60 seconds instead of default 5)
      await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          for (const record of batch) {
            logger.info(
              `[AttendanceImport] Looking for student: "${record.studentId}"`,
            );

            // Try exact match first
            let student = await tx.students.findUnique({
              where: { student_id: record.studentId },
            });

            if (student) {
              logger.info(
                `[AttendanceImport] ✓ Found via exact match: ${student.id}`,
              );
            } else {
              logger.info(
                `[AttendanceImport] ✗ Not found via exact match, trying contains...`,
              );
            }

            // If not found, try contains match (note: SQLite doesn't support mode: 'insensitive')
            if (!student && record.studentId) {
              const allStudents = await tx.students.findMany({
                where: {
                  student_id: {
                    contains: record.studentId,
                  },
                },
                take: 1,
              });
              student = allStudents[0] || null;
              if (student) {
                logger.info(
                  `[AttendanceImport] ✓ Found via contains: ${student.id}`,
                );
              }
            }

            if (!student) {
              logger.warn(
                `[AttendanceImport] ✗✗ Student "${record.studentId}" NOT FOUND in database`,
              );
              unmatchedStudentIds.add(record.studentId);
              skippedStudentNotFound++;
              continue;
            }

            // Check for existing record based on timestamp and student
            const existing = await tx.student_activities.findFirst({
              where: {
                student_id: student.id,
                start_time: record.timestamp,
              },
            });

            // Calculate end_time as 15 minutes after start_time
            const endTime = new Date(
              record.timestamp.getTime() + 15 * 60 * 1000,
            );

            // Store all imported data as metadata JSON
            // roomCategory: room/area from sheet (AVR USE, Library, etc.)
            // notes: librarian notes (if Title was detected as note, not book)
            const metadata = JSON.stringify({
              gradeLevel: record.gradeLevel,
              section: record.section, // Student's actual section (e.g., "ST. JOAN OF ARC")
              roomCategory: record.roomCategory || 'Library', // Room category from sheet
              designation: record.designation,
              sex: record.sex,
              bookTitle: record.bookTitle,
              bookAuthor: record.bookAuthor,
              notes: record.notes, // Librarian notes (if detected)
              // Borrowing-specific fields
              status: record.status, // "Borrowed", "Returned", etc.
              dueDate: record.dueDate
                ? record.dueDate.toISOString()
                : undefined,
              fine: record.fine, // Fine amount in pesos
              importedAt: new Date().toISOString(),
              lastUpdatedAt: existing ? new Date().toISOString() : undefined,
            });

            // Build description: book title if exists, otherwise notes, otherwise just activity type
            let description: string | undefined;
            if (record.bookTitle) {
              description = `${record.bookTitle}${record.bookAuthor ? ` by ${record.bookAuthor}` : ''}`;
            } else if (record.notes) {
              description = `Note: ${record.notes}`;
            }

            if (existing) {
              // UPDATE existing record with new metadata
              await tx.student_activities.update({
                where: { id: existing.id },
                data: {
                  activity_type: record.activityType || 'ATTENDANCE_IMPORT',
                  description: description || existing.description,
                  metadata: metadata,
                },
              });
              logger.info(
                `[AttendanceImport] ✓ Updated existing activity for ${record.studentId}`,
              );
              updatedCount++;
            } else {
              // INSERT new record
              await tx.student_activities.create({
                data: {
                  student_id: student.id,
                  start_time: record.timestamp,
                  end_time: endTime,
                  status: 'COMPLETED',
                  activity_type: record.activityType || 'ATTENDANCE_IMPORT',
                  description: description,
                  metadata: metadata,
                },
              });

              // Track for leaderboard update after transaction
              successfulImports.push({
                studentDbId: student.id,
                timestamp: record.timestamp,
              });

              logger.info(
                `[AttendanceImport] ✓ Inserted activity for ${record.studentId}`,
              );
              insertedCount++;
            }
          }
        },
        {
          timeout: 60000, // 60 second timeout (default is 5 seconds)
          maxWait: 10000, // Max wait time for acquiring a lock
        },
      );
    }

    logger.info(
      `[AttendanceImport] Results: inserted=${insertedCount}, updated=${updatedCount}, notFound=${skippedStudentNotFound}`,
    );
    logger.info(
      `[AttendanceImport] First 10 unmatched IDs: ${JSON.stringify(Array.from(unmatchedStudentIds).slice(0, 10))}`,
    );

    // Update leaderboard stats for all successful imports (outside transaction to avoid locks)
    if (successfulImports.length > 0) {
      logger.info(
        `[AttendanceImport] Updating leaderboard for ${successfulImports.length} records...`,
      );
      for (const item of successfulImports) {
        try {
          await LeaderboardService.recordScan(
            item.studentDbId,
            0,
            false,
            item.timestamp,
          );
        } catch (err) {
          logger.error(
            `[AttendanceImport] Failed to record leaderboard scan: ${err}`,
          );
        }
      }
      logger.info(`[AttendanceImport] Leaderboard update complete`);
    }

    return {
      insertedCount,
      updatedCount,
      skippedStudentNotFound,
      unmatchedStudentIds: Array.from(unmatchedStudentIds).slice(0, 20), // Only return first 20
    };
  }

  /**
   * Get attendance records for export
   */
  public async getAttendanceForExport(
    startDate: Date,
    endDate: Date,
  ): Promise<ProcessedAttendanceRecord[]> {
    const activities = await prisma.student_activities.findMany({
      where: {
        start_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        student: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            section: true,
            type: true,
            gender: true,
          },
        },
      },
      orderBy: {
        start_time: 'desc',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return activities.map((a: any) => {
      // Determine activity type from activity_type field
      type ActivityType =
        | 'Check In'
        | 'Check Out'
        | 'Borrowed'
        | 'Print'
        | 'Room Use'
        | 'Recreation';
      let activityType: ActivityType = 'Check In';
      const actType = (a.activity_type || '').toLowerCase();
      if (actType.includes('borrow') || actType.includes('checkout')) {
        activityType = 'Borrowed';
      } else if (actType.includes('print')) {
        activityType = 'Print';
      } else if (actType.includes('room')) {
        activityType = 'Room Use';
      } else if (actType.includes('recreation')) {
        activityType = 'Recreation';
      } else if (a.status === 'COMPLETED' || actType.includes('out')) {
        activityType = 'Check Out';
      }

      return {
        timestamp: a.start_time,
        studentId: a.student?.student_id || '',
        surname: a.student?.last_name || 'Unknown',
        firstName: a.student?.first_name || 'Unknown',
        gradeLevel: a.student?.grade_level
          ? `GRADE ${a.student.grade_level}`
          : '',
        section: a.student?.section || '',
        roomCategory: 'Library', // Default for exported records
        designation: a.student?.type || '',
        sex: a.student?.gender || '',
        action: a.status === 'COMPLETED' ? 'Check Out' : 'Check In',
        activityType,
        bookTitle: '',
        bookAuthor: '',
        notes: undefined,
        status: undefined,
        dueDate: undefined,
        fine: undefined,
      };
    });
  }
}

export const attendanceRepository = AttendanceRepository.getInstance();
