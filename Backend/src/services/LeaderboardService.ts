import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * Helper function to check if a student is personnel
 */
async function isPersonnel(studentId: string): Promise<boolean> {
  const student = await prisma.students.findUnique({
    where: { id: studentId },
    select: { grade_category: true, student_id: true },
  });

  if (!student) {
    return false;
  }

  return (
    student.grade_category === 'PERSONNEL' ||
    student.student_id?.startsWith('PN') === true
  );
}

export class LeaderboardService {
  /**
   * Record a scan for a student
   * @param studentId - The student's database ID
   * @param duration - Duration in minutes (for checkout)
   * @param excludeFromLeaderboard - If true, don't count this scan (e.g., manual lookup, quick service)
   * NOTE: Personnel scans are automatically excluded from leaderboard
   */
  static async recordScan(
    studentId: string,
    duration: number = 0,
    excludeFromLeaderboard: boolean = false,
    scanDate?: Date, // Optional: use this date for year/month instead of now (for imports)
  ) {
    // Skip recording if excluded (manual lookup, quick service, etc.)
    if (excludeFromLeaderboard) {
      logger.info(
        'Skipping leaderboard recording (excludeFromLeaderboard=true)',
        {
          studentId,
          duration,
        },
      );
      return;
    }

    // Skip recording for personnel - they shouldn't appear on student leaderboard
    if (await isPersonnel(studentId)) {
      logger.info('Skipping leaderboard recording (personnel)', { studentId });
      return;
    }

    try {
      // Use provided scanDate for historical imports, or current date for live scans
      const recordDate = scanDate || new Date();
      const year = recordDate.getFullYear();
      const month = recordDate.getMonth() + 1;

      // eslint-disable-next-line
      await (prisma as any).student_scan_stats.upsert({
        where: {
          student_id_year_month: { student_id: studentId, year, month },
        },
        update: {
          total_scans: { increment: 1 },
          total_minutes: { increment: duration },
          last_scan_date: recordDate,
        },
        create: {
          student_id: studentId,
          year,
          month,
          total_scans: 1,
          total_minutes: duration,
          last_scan_date: recordDate,
        },
      });
    } catch (error) {
      logger.error('Failed to record scan stats:', error);
      // Don't throw error to prevent blocking the main scan flow
    }
  }

  /**
   * Get monthly leaderboard
   * NOTE: Only includes students, excludes personnel (grade_category = 'PERSONNEL')
   */
  static async getMonthlyLeaderboard(
    year: number,
    month: number,
    limit = 100,
    gradeLevel?: number,
    section?: string,
  ) {
    try {
      // Build student filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const studentFilter: any = {
        AND: [
          {
            OR: [
              { grade_category: null },
              { grade_category: { not: 'PERSONNEL' } },
            ],
          },
          { student_id: { not: { startsWith: 'PN' } } },
        ],
      };

      // Add grade level filter if provided
      if (gradeLevel !== undefined && gradeLevel !== null) {
        studentFilter.AND.push({ grade_level: gradeLevel });
      }

      // Add section filter if provided
      if (section) {
        studentFilter.AND.push({ section: { contains: section } });
      }

      // eslint-disable-next-line
      const stats = await (prisma as any).student_scan_stats.findMany({
        where: {
          year,
          month,
          student: studentFilter,
        },
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              section: true,
              photo_url: true,
            },
          },
        },
        orderBy: [{ total_scans: 'desc' }, { total_minutes: 'desc' }],
        take: limit,
      });

      // eslint-disable-next-line
      return stats.map((stat: any, index: number) => ({
        rank: index + 1,
        studentId: stat.student.student_id,
        name: `${stat.student.first_name} ${stat.student.last_name}`,
        gradeLevel:
          stat.student.grade_level !== null &&
          stat.student.grade_level !== undefined
            ? String(stat.student.grade_level)
            : '',
        section: stat.student.section || '',
        scanCount: stat.total_scans,
        totalMinutes: stat.total_minutes,
        photoUrl: stat.student.photo_url,
      }));
    } catch (error) {
      logger.error('Failed to get monthly leaderboard:', error);
      return [];
    }
  }

  /**
   * Get yearly leaderboard
   * NOTE: Only includes students, excludes personnel (grade_category = 'PERSONNEL')
   */
  static async getYearlyLeaderboard(
    year: number,
    limit = 100,
    gradeLevel?: number,
    section?: string,
  ) {
    try {
      // Build student filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const studentFilter: any = {
        AND: [
          {
            OR: [
              { grade_category: null },
              { grade_category: { not: 'PERSONNEL' } },
            ],
          },
          { student_id: { not: { startsWith: 'PN' } } },
        ],
      };

      // Add grade level filter if provided
      if (gradeLevel !== undefined && gradeLevel !== null) {
        studentFilter.AND.push({ grade_level: gradeLevel });
      }

      // Add section filter if provided
      if (section) {
        studentFilter.AND.push({ section: { contains: section } });
      }

      // First, get IDs of filtered students
      const validStudents = await prisma.students.findMany({
        where: studentFilter,
        select: { id: true },
      });
      const validStudentIds = validStudents.map(s => s.id);

      // Aggregate stats by student for the year
      // eslint-disable-next-line
      const stats = await (prisma as any).student_scan_stats.groupBy({
        by: ['student_id'],
        where: {
          year,
          student_id: { in: validStudentIds },
        },
        _sum: {
          total_scans: true,
          total_minutes: true,
        },
        orderBy: {
          _sum: {
            total_scans: 'desc',
          },
        },
        take: limit,
      });

      // Fetch student details
      // eslint-disable-next-line
      const studentIds = stats.map((s: any) => s.student_id);
      const students = await prisma.students.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          student_id: true,
          first_name: true,
          last_name: true,
          grade_level: true,
          section: true,
          photo_url: true,
        },
      });

      const studentMap = new Map(students.map(s => [s.id, s]));

      // eslint-disable-next-line
      return stats.map((stat: any, index: number) => {
        const student = studentMap.get(stat.student_id);
        return {
          rank: index + 1,
          studentId: student?.student_id || 'Unknown',
          name: student
            ? `${student.first_name} ${student.last_name}`
            : 'Unknown Student',
          gradeLevel:
            student?.grade_level !== null && student?.grade_level !== undefined
              ? String(student.grade_level)
              : '',
          section: student?.section || '',
          scanCount: stat._sum.total_scans || 0,
          totalMinutes: stat._sum.total_minutes || 0,
          photoUrl: student?.photo_url,
        };
      });
    } catch (error) {
      logger.error('Failed to get yearly leaderboard:', error);
      return [];
    }
  }

  /**
   * Generate monthly rewards (to be called via cron or admin action)
   */
  static async generateMonthlyRewards(year: number, month: number) {
    try {
      // Check if rewards already exist
      // eslint-disable-next-line
      const existing = await (prisma as any).monthly_rewards.findFirst({
        where: { year, month },
      });

      if (existing) {
        return {
          success: false,
          message: 'Rewards already generated for this month',
        };
      }

      const top3 = await this.getMonthlyLeaderboard(year, month, 3);

      if (top3.length === 0) {
        return { success: false, message: 'No activity found for this month' };
      }

      const rewards = [];
      for (const winner of top3) {
        // Find student internal ID
        const student = await prisma.students.findUnique({
          where: { student_id: winner.studentId },
        });

        if (student) {
          // eslint-disable-next-line
          const reward = await (prisma as any).monthly_rewards.create({
            data: {
              student_id: student.id,
              year,
              month,
              rank: winner.rank,
              total_scans: winner.totalScans,
              reward_type: 'MOST_ACTIVE',
              notes: `Rank ${winner.rank} with ${winner.totalScans} scans`,
            },
          });
          rewards.push(reward);
        }
      }

      return { success: true, count: rewards.length, rewards };
    } catch (error) {
      logger.error('Failed to generate monthly rewards:', error);
      throw error;
    }
  }

  /**
   * Reset leaderboard stats for a specific month/year or all time
   * @param year - Optional year to reset
   * @param month - Optional month to reset (requires year)
   * @returns Number of records deleted
   */
  static async resetLeaderboard(year?: number, month?: number) {
    try {
      let whereClause = {};

      if (year && month) {
        whereClause = { year, month };
        logger.info(`Resetting leaderboard for ${month}/${year}`);
      } else if (year) {
        whereClause = { year };
        logger.info(`Resetting leaderboard for year ${year}`);
      } else {
        logger.info('Resetting entire leaderboard');
      }

      // Delete scan stats
      // eslint-disable-next-line
      const deleteResult = await (prisma as any).student_scan_stats.deleteMany({
        where: whereClause,
      });

      // Also delete rewards if resetting
      if (Object.keys(whereClause).length > 0) {
        // eslint-disable-next-line
        await (prisma as any).monthly_rewards.deleteMany({
          where: whereClause,
        });
      }

      logger.info(`Leaderboard reset: ${deleteResult.count} records deleted`);
      return { success: true, count: deleteResult.count };
    } catch (error) {
      logger.error('Failed to reset leaderboard:', error);
      throw error;
    }
  }
}
