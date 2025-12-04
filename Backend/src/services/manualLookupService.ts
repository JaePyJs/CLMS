/**
 * Manual Lookup Service
 * Handles students who forgot their barcode
 * - Allows librarian to manually look up and check in students
 * - Tracks these sessions separately (excludeFromLeaderboard flag)
 * - Encourages students to bring their barcode next time
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';

export interface ManualLookupResult {
  success: boolean;
  message: string;
  student?: {
    id: string;
    studentId: string;
    name: string;
    gradeLevel: string;
    section: string;
    photoUrl?: string;
  };
  activity?: {
    id: string;
    activity_type: string;
    start_time: Date;
    status: string;
  };
  warning?: string;
}

export interface ManualLookupStats {
  totalManualLookups: number;
  uniqueStudents: number;
  frequentOffenders: Array<{
    studentId: string;
    studentName: string;
    count: number;
  }>;
}

/**
 * Manual Lookup Service
 * For handling students who forgot their barcode
 */
export class ManualLookupService {
  /**
   * Search for student by name (for manual lookup)
   * Note: SQLite doesn't support case-insensitive mode, so we search both cases
   */
  static async searchByName(
    query: string,
    limit: number = 10,
  ): Promise<ManualLookupResult['student'][]> {
    try {
      const searchTerms = query.trim().toLowerCase().split(/\s+/);

      // For SQLite, search both lowercase and original case
      const students = await prisma.students.findMany({
        where: {
          AND: searchTerms.map(term => ({
            OR: [
              { first_name: { contains: term } },
              { first_name: { contains: term.charAt(0).toUpperCase() + term.slice(1) } },
              { last_name: { contains: term } },
              { last_name: { contains: term.charAt(0).toUpperCase() + term.slice(1) } },
              { student_id: { contains: term } },
              { student_id: { contains: term.toUpperCase() } },
              { barcode: { contains: term } },
            ],
          })),
          is_active: true,
        },
        select: {
          id: true,
          student_id: true,
          first_name: true,
          last_name: true,
          grade_level: true,
          section: true,
          photo_url: true,
        },
        take: limit * 2, // Fetch more to account for duplicates
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      });

      // Deduplicate and limit results
      const unique = students.filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx).slice(0, limit);

      return unique.map(s => ({
        id: s.id,
        studentId: s.student_id,
        name: `${s.first_name} ${s.last_name}`,
        gradeLevel: s.grade_level?.toString() || '',
        section: s.section || '',
        photoUrl: s.photo_url || undefined,
      }));
    } catch (error) {
      logger.error('Search by name error:', error);
      return [];
    }
  }

  /**
   * Check in a student manually (forgot barcode)
   * - Creates activity with excludeFromLeaderboard flag
   * - Tracks the manual lookup for reporting
   */
  static async manualCheckIn(
    studentId: string,
    librarianId: string,
    reason: string = 'Forgot barcode',
  ): Promise<ManualLookupResult> {
    try {
      // Find student
      const student = await prisma.students.findFirst({
        where: {
          OR: [{ id: studentId }, { student_id: studentId }],
        },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found',
        };
      }

      // Check if already checked in
      const existingActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: student.id,
          status: 'ACTIVE',
        },
      });

      if (existingActivity) {
        return {
          success: false,
          message: 'Student is already checked in',
          student: {
            id: student.id,
            studentId: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            gradeLevel: student.grade_level?.toString() || '',
            section: student.section || '',
            photoUrl: student.photo_url || undefined,
          },
        };
      }

      // Count previous manual lookups for this student
      const previousManualLookups = await prisma.student_activities.count({
        where: {
          student_id: student.id,
          metadata: { contains: '"manualLookup":true' },
        },
      });

      // Create activity with manual lookup flag (excluded from leaderboard)
      const activity = await prisma.student_activities.create({
        data: {
          student_id: student.id,
          activity_type: 'LIBRARY_VISIT',
          description: `Library check-in (Manual - ${reason})`,
          status: 'ACTIVE',
          metadata: JSON.stringify({
            manualLookup: true,
            excludeFromLeaderboard: true,
            reason,
            librarianId,
            previousManualLookups,
          }),
        },
      });

      // Emit WebSocket event with manual lookup flag
      websocketServer.emitStudentCheckIn({
        activityId: activity.id,
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        gender: student.gender || undefined,
        checkinTime: activity.start_time.toISOString(),
        autoLogoutAt: new Date(
          activity.start_time.getTime() + 30 * 60000,
        ).toISOString(),
      });

      // Emit manual lookup event for tracking
      websocketServer.broadcastToRoom('librarian', {
        id: `ml-${activity.id}`,
        type: 'manual_lookup',
        data: {
          studentId: student.id,
          studentName: `${student.first_name} ${student.last_name}`,
          reason,
          previousCount: previousManualLookups,
        },
        timestamp: new Date(),
      });

      logger.info('Manual check-in completed', {
        studentId: student.student_id,
        reason,
        librarianId,
        previousManualLookups,
      });

      // Generate warning if student frequently forgets barcode
      let warning: string | undefined;
      if (previousManualLookups >= 5) {
        warning = `⚠️ This student has forgotten their barcode ${previousManualLookups + 1} times. Consider following up.`;
      } else if (previousManualLookups >= 2) {
        warning = `Note: This student has forgotten their barcode ${previousManualLookups + 1} times.`;
      }

      return {
        success: true,
        message: `${student.first_name} ${student.last_name} checked in manually. This visit won't count towards leaderboard.`,
        student: {
          id: student.id,
          studentId: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          gradeLevel: student.grade_level?.toString() || '',
          section: student.section || '',
          photoUrl: student.photo_url || undefined,
        },
        activity,
        warning,
      };
    } catch (error) {
      logger.error('Manual check-in error:', error);
      return {
        success: false,
        message: 'Failed to check in student manually',
      };
    }
  }

  /**
   * Get manual lookup statistics
   * Helps librarians identify students who frequently forget their barcode
   */
  static async getManualLookupStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<ManualLookupStats> {
    try {
      const whereClause: {
        metadata: { contains: string };
        start_time?: { gte?: Date; lte?: Date };
      } = {
        metadata: { contains: '"manualLookup":true' },
      };

      if (startDate || endDate) {
        whereClause.start_time = {};
        if (startDate) {
          whereClause.start_time.gte = startDate;
        }
        if (endDate) {
          whereClause.start_time.lte = endDate;
        }
      }

      // Get total manual lookups
      const totalManualLookups = await prisma.student_activities.count({
        where: whereClause,
      });

      // Get unique students
      const uniqueStudentIds = await prisma.student_activities.findMany({
        where: whereClause,
        select: { student_id: true },
        distinct: ['student_id'],
      });

      // Get frequent offenders (students who forgot barcode 3+ times)
      const studentCounts = await prisma.student_activities.groupBy({
        by: ['student_id'],
        where: whereClause,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        having: { id: { _count: { gte: 3 } } },
        take: 10,
      });

      // Get student details for frequent offenders
      const frequentOffenders: ManualLookupStats['frequentOffenders'] = [];
      for (const sc of studentCounts) {
        const student = await prisma.students.findUnique({
          where: { id: sc.student_id },
          select: { student_id: true, first_name: true, last_name: true },
        });
        if (student) {
          frequentOffenders.push({
            studentId: student.student_id,
            studentName: `${student.first_name} ${student.last_name}`,
            count: sc._count.id,
          });
        }
      }

      return {
        totalManualLookups,
        uniqueStudents: uniqueStudentIds.length,
        frequentOffenders,
      };
    } catch (error) {
      logger.error('Get manual lookup stats error:', error);
      return {
        totalManualLookups: 0,
        uniqueStudents: 0,
        frequentOffenders: [],
      };
    }
  }
}
