import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export class LeaderboardService {
  /**
   * Record a scan for a student
   */
  static async recordScan(studentId: string, duration: number = 0) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      // eslint-disable-next-line
      await (prisma as any).student_scan_stats.upsert({
        where: {
          student_id_year_month: { student_id: studentId, year, month },
        },
        update: {
          total_scans: { increment: 1 },
          total_minutes: { increment: duration },
          last_scan_date: now,
        },
        create: {
          student_id: studentId,
          year,
          month,
          total_scans: 1,
          total_minutes: duration,
          last_scan_date: now,
        },
      });
    } catch (error) {
      logger.error('Failed to record scan stats:', error);
      // Don't throw error to prevent blocking the main scan flow
    }
  }

  /**
   * Get monthly leaderboard
   */
  static async getMonthlyLeaderboard(year: number, month: number, limit = 10) {
    try {
      // eslint-disable-next-line
      const stats = await (prisma as any).student_scan_stats.findMany({
        where: { year, month },
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
        grade: stat.student.grade_level,
        section: stat.student.section,
        totalScans: stat.total_scans,
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
   */
  static async getYearlyLeaderboard(year: number, limit = 10) {
    try {
      // Aggregate stats by student for the year
      // eslint-disable-next-line
      const stats = await (prisma as any).student_scan_stats.groupBy({
        by: ['student_id'],
        where: { year },
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
          grade: student?.grade_level || 0,
          section: student?.section || '',
          totalScans: stat._sum.total_scans || 0,
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
}
