/**
 * Quick Service Mode
 * Handles "print and go" students who just need to use a service quickly
 * without full library session tracking
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';

export type QuickServiceType =
  | 'PRINTING'
  | 'PHOTOCOPY'
  | 'LAMINATION'
  | 'INQUIRY'
  | 'OTHER';

export interface QuickServiceResult {
  success: boolean;
  message: string;
  serviceId?: string;
  student?: {
    id: string;
    studentId: string;
    name: string;
    gradeLevel: string;
  };
}

export interface QuickServiceEntry {
  id: string;
  studentId: string;
  studentName: string;
  serviceType: QuickServiceType;
  notes?: string;
  startTime: Date;
  endTime?: Date | null;
  excludeFromLeaderboard: boolean;
}

/**
 * Quick Service Mode - for students who just need to print/photocopy and leave
 * These visits are tracked but don't count towards leaderboard or regular attendance
 */
export class QuickServiceMode {
  /**
   * Start a quick service session
   * This is for students who just need to print/photocopy and immediately leave
   */
  static async startQuickService(
    studentId: string,
    serviceType: QuickServiceType,
    notes?: string,
    usedManualLookup: boolean = false,
  ): Promise<QuickServiceResult> {
    try {
      // Find student by ID or barcode
      const student = await prisma.students.findFirst({
        where: {
          OR: [
            { student_id: studentId },
            { barcode: studentId },
            { id: studentId },
          ],
        },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found',
        };
      }

      // Check if student has an existing active session
      const existingSession = await prisma.student_activities.findFirst({
        where: {
          student_id: student.id,
          status: 'ACTIVE',
        },
      });

      if (existingSession) {
        // If they have an active session, just log the service but don't create new activity
        logger.info('Quick service for already checked-in student', {
          studentId: student.student_id,
          serviceType,
          existingActivityId: existingSession.id,
        });

        return {
          success: true,
          message: `Service logged. Student is already checked in.`,
          serviceId: existingSession.id,
          student: {
            id: student.id,
            studentId: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            gradeLevel: student.grade_level?.toString() || '',
          },
        };
      }

      // Create a quick service activity (immediately completed, no cooldown, no leaderboard)
      const activity = await prisma.student_activities.create({
        data: {
          student_id: student.id,
          activity_type: 'QUICK_SERVICE',
          description: `Quick Service: ${serviceType}${notes ? ` - ${notes}` : ''}`,
          status: 'COMPLETED',
          end_time: new Date(),
          metadata: JSON.stringify({
            serviceType,
            quickService: true,
            usedManualLookup,
            excludeFromLeaderboard: true,
          }),
        },
      });

      // For PRINTING, PHOTOCOPY, or LAMINATION - also create a print job record
      let printJobId: string | undefined;
      if (['PRINTING', 'PHOTOCOPY', 'LAMINATION'].includes(serviceType)) {
        // Get default pricing (SHORT + BW as default for quick service)
        const defaultPricing = await prisma.printing_pricing.findFirst({
          where: {
            paper_size: 'SHORT',
            color_level: 'BW',
            is_active: true,
          },
        });

        const pricePerPage = defaultPricing?.price || 2; // Default ₱2 if no pricing set

        const printJob = await prisma.printing_jobs.create({
          data: {
            student_id: student.id,
            paper_size: 'SHORT',
            color_level: 'BW',
            pages: 1, // Default 1 page for quick service
            price_per_page: pricePerPage,
            total_cost: pricePerPage,
            paid: false,
            metadata: JSON.stringify({
              quickService: true,
              serviceType,
              activityId: activity.id,
              notes: notes || undefined,
            }),
          },
        });
        printJobId = printJob.id;

        logger.info('Print job created for quick service', {
          printJobId: printJob.id,
          studentId: student.student_id,
          serviceType,
        });
      }

      // Emit event but mark as quick service
      websocketServer.broadcastToRoom('librarian', {
        id: `qs-${activity.id}`,
        type: 'quick_service',
        data: {
          activityId: activity.id,
          studentId: student.id,
          studentName: `${student.first_name} ${student.last_name}`,
          serviceType,
          usedManualLookup,
          printJobId,
        },
        timestamp: new Date(),
      });

      logger.info('Quick service completed', {
        studentId: student.student_id,
        serviceType,
        activityId: activity.id,
        printJobId,
        usedManualLookup,
      });

      return {
        success: true,
        message: `Quick service (${serviceType}) logged successfully${printJobId ? ' - Print job created' : ''}`,
        serviceId: activity.id,
        student: {
          id: student.id,
          studentId: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          gradeLevel: student.grade_level?.toString() || '',
        },
      };
    } catch (error) {
      logger.error('Quick service error:', error);
      return {
        success: false,
        message: 'Failed to log quick service',
      };
    }
  }

  /**
   * Get quick service history for reporting
   */
  static async getQuickServiceHistory(
    startDate?: Date,
    endDate?: Date,
    limit: number = 50,
  ): Promise<QuickServiceEntry[]> {
    try {
      const whereClause: {
        activity_type: string;
        start_time?: { gte?: Date; lte?: Date };
      } = {
        activity_type: 'QUICK_SERVICE',
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

      const activities = await prisma.student_activities.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: { start_time: 'desc' },
        take: limit,
      });

      return activities.map(
        (activity: {
          id: string;
          metadata: string | null;
          description: string | null;
          start_time: Date;
          end_time: Date | null;
          student: {
            id: string;
            student_id: string;
            first_name: string;
            last_name: string;
          } | null;
        }) => {
          let serviceType: QuickServiceType = 'OTHER';
          let notes: string | undefined;

          try {
            const parsed = JSON.parse(activity.metadata || '{}');
            serviceType = parsed.serviceType || 'OTHER';
            notes = parsed.notes;
          } catch {
            // If metadata is not JSON, use description
            const desc = activity.description || '';
            if (desc.includes('PRINTING')) {
              serviceType = 'PRINTING';
            } else if (desc.includes('PHOTOCOPY')) {
              serviceType = 'PHOTOCOPY';
            } else if (desc.includes('LAMINATION')) {
              serviceType = 'LAMINATION';
            } else if (desc.includes('INQUIRY')) {
              serviceType = 'INQUIRY';
            }
          }

          return {
            id: activity.id,
            studentId: activity.student?.student_id || 'Unknown',
            studentName: activity.student
              ? `${activity.student.first_name} ${activity.student.last_name}`
              : 'Unknown',
            serviceType,
            notes,
            startTime: activity.start_time,
            endTime: activity.end_time,
            excludeFromLeaderboard: true,
          };
        },
      );
    } catch (error) {
      logger.error('Get quick service history error:', error);
      return [];
    }
  }

  /**
   * Get quick service statistics
   */
  static async getQuickServiceStats(startDate?: Date, endDate?: Date) {
    try {
      const whereClause: {
        activity_type: string;
        start_time?: { gte?: Date; lte?: Date };
      } = {
        activity_type: 'QUICK_SERVICE',
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

      const total = await prisma.student_activities.count({
        where: whereClause,
      });

      // Group by service type from metadata field
      const activities = await prisma.student_activities.findMany({
        where: whereClause,
        select: { metadata: true, description: true },
      });

      const byType: Record<string, number> = {
        PRINTING: 0,
        PHOTOCOPY: 0,
        LAMINATION: 0,
        INQUIRY: 0,
        OTHER: 0,
      };

      activities.forEach(
        (activity: { metadata: string | null; description: string | null }) => {
          let serviceType = 'OTHER';
          try {
            const parsed = JSON.parse(activity.metadata || '{}');
            serviceType = parsed.serviceType || 'OTHER';
          } catch {
            const desc = activity.description || '';
            if (desc.includes('PRINTING')) {
              serviceType = 'PRINTING';
            } else if (desc.includes('PHOTOCOPY')) {
              serviceType = 'PHOTOCOPY';
            } else if (desc.includes('LAMINATION')) {
              serviceType = 'LAMINATION';
            } else if (desc.includes('INQUIRY')) {
              serviceType = 'INQUIRY';
            }
          }
          byType[serviceType] = (byType[serviceType] || 0) + 1;
        },
      );

      return {
        total,
        byType,
      };
    } catch (error) {
      logger.error('Get quick service stats error:', error);
      return { total: 0, byType: {} };
    }
  }
}
