import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

export interface AttendanceExportData {
  studentId: string;
  studentName: string;
  gradeLevel: string;
  checkInTime: Date;
  checkOutTime?: Date;
  duration?: number; // in minutes
  status: string;
  activityType: string;
}

/**
 * Attendance Export Service
 * Handles exporting attendance data to CSV, Excel, and Google Sheets
 */
export class AttendanceExportService {
  /**
   * Get attendance data for a date range
   */
  static async getAttendanceData(
    startDate: Date,
    endDate: Date,
  ): Promise<AttendanceExportData[]> {
    try {
      const activities = await prisma.student_activities.findMany({
        where: {
          start_time: {
            gte: startDate,
            lte: endDate,
          },
          activity_type: {
            contains: 'SELF_SERVICE',
          },
        },
        include: {
          student: {
            select: {
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          },
        },
        orderBy: {
          start_time: 'desc',
        },
      });

      return activities.map(activity => ({
        studentId: activity.student.student_id,
        studentName: `${activity.student.first_name} ${activity.student.last_name}`,
        gradeLevel: `Grade ${activity.student.grade_level}`,
        checkInTime: activity.start_time,
        checkOutTime: activity.end_time || undefined,
        duration: activity.end_time
          ? Math.floor(
              (activity.end_time.getTime() - activity.start_time.getTime()) /
                1000 /
                60,
            )
          : undefined,
        status: activity.status,
        activityType: activity.activity_type,
      }));
    } catch (error) {
      logger.error('Error getting attendance data:', error);
      return [];
    }
  }

  /**
   * Export attendance data to CSV
   */
  static async exportToCSV(startDate: Date, endDate: Date): Promise<string> {
    const data = await this.getAttendanceData(startDate, endDate);

    const headers = [
      'Student ID',
      'Student Name',
      'Grade Level',
      'Check-In Time',
      'Check-Out Time',
      'Duration (Minutes)',
      'Status',
      'Activity Type',
    ];

    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = [
        row.studentId,
        `"${row.studentName}"`, // Quote to handle commas in names
        row.gradeLevel,
        row.checkInTime.toLocaleString(),
        row.checkOutTime ? row.checkOutTime.toLocaleString() : 'N/A',
        row.duration ? row.duration.toString() : 'N/A',
        row.status,
        row.activityType,
      ];
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Generate summary statistics
   */
  static async generateSummary(startDate: Date, endDate: Date) {
    const data = await this.getAttendanceData(startDate, endDate);

    const totalCheckIns = data.length;
    const uniqueStudents = new Set(data.map(d => d.studentId)).size;
    const totalMinutes = data.reduce((sum, d) => sum + (d.duration || 0), 0);
    const averageTime =
      totalCheckIns > 0 ? Math.round(totalMinutes / totalCheckIns) : 0;

    // Group by grade level
    const gradeStats = data.reduce(
      (acc, d) => {
        const grade = d.gradeLevel;
        if (!acc[grade]) {
          acc[grade] = { count: 0, totalTime: 0 };
        }
        acc[grade].count++;
        acc[grade].totalTime += d.duration || 0;
        return acc;
      },
      {} as Record<string, { count: number; totalTime: number }>,
    );

    return {
      period: {
        start: startDate.toLocaleDateString(),
        end: endDate.toLocaleDateString(),
      },
      totalCheckIns,
      uniqueStudents,
      totalMinutes,
      averageTime,
      gradeStats,
    };
  }

  /**
   * Export to Google Sheets format (will be handled by Google Sheets API)
   */
  static async prepareGoogleSheetsData(startDate: Date, endDate: Date) {
    const data = await this.getAttendanceData(startDate, endDate);

    // Convert to sheets format (array of arrays)
    const headers = [
      'Student ID',
      'Student Name',
      'Grade Level',
      'Check-In Time',
      'Check-Out Time',
      'Duration (Minutes)',
      'Status',
      'Activity Type',
    ];

    const rows = data.map(row => [
      row.studentId,
      row.studentName,
      row.gradeLevel,
      row.checkInTime.toISOString(),
      row.checkOutTime ? row.checkOutTime.toISOString() : '',
      row.duration || 0,
      row.status,
      row.activityType,
    ]);

    return {
      headers,
      rows,
      title: `CLMS Attendance Report (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`,
    };
  }
}
