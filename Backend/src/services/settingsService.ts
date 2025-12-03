import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';

export interface Setting {
  key: string;
  value: string;
  description?: string;
  category: string;
}

export interface SettingUpdate {
  key: string;
  value: string;
}

/**
 * Settings Service
 * Handles system configuration settings
 */
export class SettingsService {
  /**
   * Get all settings
   */
  static async getAllSettings(): Promise<Setting[]> {
    try {
      const settings = await prisma.system_settings.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      });

      return settings.map(s => ({
        key: s.key,
        value: s.value,
        description: s.description || undefined,
        category: s.category,
      }));
    } catch (error) {
      logger.error('Error getting all settings:', error);
      return [];
    }
  }

  /**
   * Get settings by category
   */
  static async getSettingsByCategory(category: string): Promise<Setting[]> {
    try {
      const settings = await prisma.system_settings.findMany({
        where: { category },
        orderBy: { key: 'asc' },
      });

      return settings.map(s => ({
        key: s.key,
        value: s.value,
        description: s.description || undefined,
        category: s.category,
      }));
    } catch (error) {
      logger.error(`Error getting settings for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Get a specific setting by key
   */
  static async getSetting(key: string): Promise<string | null> {
    try {
      const setting = await prisma.system_settings.findUnique({
        where: { key },
      });

      return setting?.value || null;
    } catch (error) {
      logger.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Update a setting
   */
  static async updateSetting(
    key: string,
    value: string,
    userId?: string,
    category?: string,
  ): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = { value, updated_by: userId };
      if (category) {
        updateData.category = category;
      }

      await prisma.system_settings.upsert({
        where: { key },
        update: updateData,
        create: {
          key,
          value,
          category: category || 'general',
          updated_by: userId,
        },
      });

      return true;
    } catch (error) {
      logger.error(`Error updating setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Update multiple settings
   */
  static async updateSettings(
    settings: SettingUpdate[],
    userId?: string,
  ): Promise<boolean> {
    try {
      for (const setting of settings) {
        await this.updateSetting(setting.key, setting.value, userId);
      }
      return true;
    } catch (error) {
      logger.error('Error updating settings:', error);
      return false;
    }
  }

  /**
   * Initialize default settings
   */
  static async initializeDefaultSettings(): Promise<void> {
    try {
      const defaultSettings = [
        {
          key: 'attendance.min_check_in_interval_minutes',
          value: '10',
          description:
            'Minimum time (in minutes) a student must wait before checking in again',
          category: 'attendance',
        },
        {
          key: 'attendance.default_session_time_minutes',
          value: '30',
          description:
            'Default session time (in minutes) for student activities',
          category: 'attendance',
        },
      ];

      for (const setting of defaultSettings) {
        await prisma.system_settings.upsert({
          where: { key: setting.key },
          update: {},
          create: setting,
        });
      }

      logger.info('Default settings initialized');
    } catch (error) {
      logger.error('Error initializing default settings:', error);
    }
  }

  /**
   * Reset daily data - clears today's check-ins and active sessions
   * Useful for starting fresh each day or after server restarts
   */
  static async resetDailyData(deleteTodaysActivities = false): Promise<{
    activitiesAffected: number;
    equipmentReset: number;
    equipmentSessionsDeleted: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let activitiesAffectedCount = 0;
      if (deleteTodaysActivities) {
        // Delete today's activities (start_time >= today)
        const deletedActivities = await prisma.student_activities.deleteMany({
          where: {
            start_time: { gte: today },
          },
        });
        activitiesAffectedCount = deletedActivities.count;
      } else {
        // Mark active student activities as completed to preserve history
        const endedActivities = await prisma.student_activities.updateMany({
          where: {
            status: 'ACTIVE',
          },
          data: {
            status: 'COMPLETED',
            end_time: new Date(),
          },
        });
        activitiesAffectedCount = endedActivities.count;
      }

      // Reset all equipment to AVAILABLE status
      const resetEquipment = await prisma.equipment.updateMany({
        where: {
          status: {
            not: 'AVAILABLE',
          },
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      // Delete equipment sessions for today (so sessions are cleared) - keep historical activities
      const deletedEquipmentSessions =
        await prisma.equipment_sessions.deleteMany({
          where: {
            session_start: { gte: today },
          },
        });

      logger.info('Daily data reset completed', {
        activitiesAffected: activitiesAffectedCount,
        equipmentReset: resetEquipment.count,
        equipmentSessionsDeleted: deletedEquipmentSessions.count,
      });

      return {
        activitiesAffected: activitiesAffectedCount,
        equipmentReset: resetEquipment.count,
        equipmentSessionsDeleted: deletedEquipmentSessions.count,
      };
    } catch (error) {
      logger.error('Error resetting daily data:', error);
      throw error;
    }
  }

  /**
   * Reset ALL data - nuclear option for complete system reset
   * WARNING: This will delete all transactional data!
   */
  static async resetAllData(): Promise<{
    activitiesDeleted: number;
    equipmentSessionsDeleted: number;
    checkoutsDeleted: number;
    equipmentReset: number;
  }> {
    try {
      // Delete all student activities
      const deletedActivities = await prisma.student_activities.deleteMany({});

      // Delete all equipment sessions
      const deletedEquipmentSessions =
        await prisma.equipment_sessions.deleteMany({});

      // Delete all book checkouts (borrowing history)
      const deletedCheckouts = await prisma.book_checkouts.deleteMany({});

      // Reset all equipment to AVAILABLE status
      const resetEquipment = await prisma.equipment.updateMany({
        data: {
          status: 'AVAILABLE',
        },
      });

      logger.warn('⚠️ ALL DATA RESET completed', {
        activitiesDeleted: deletedActivities.count,
        equipmentSessionsDeleted: deletedEquipmentSessions.count,
        checkoutsDeleted: deletedCheckouts.count,
        equipmentReset: resetEquipment.count,
      });

      return {
        activitiesDeleted: deletedActivities.count,
        equipmentSessionsDeleted: deletedEquipmentSessions.count,
        checkoutsDeleted: deletedCheckouts.count,
        equipmentReset: resetEquipment.count,
      };
    } catch (error) {
      logger.error('Error resetting all data:', error);
      throw error;
    }
  }

  /**
   * NUCLEAR RESET - Complete database wipe for testing
   * WARNING: This will delete EVERYTHING including students, books, equipment, users!
   */
  static async nuclearReset(): Promise<{
    activitiesDeleted: number;
    equipmentSessionsDeleted: number;
    checkoutsDeleted: number;
    studentsDeleted: number;
    booksDeleted: number;
    equipmentDeleted: number;
    usersDeleted: number;
  }> {
    try {
      // Delete in order to respect foreign key constraints
      // 1. Delete junction tables first
      await prisma.student_activities_sections.deleteMany({});
      await prisma.archived_activities_sections.deleteMany({});

      // 2. Delete all student activities
      const deletedActivities = await prisma.student_activities.deleteMany({});

      // 3. Delete archived activities
      await prisma.student_activities_archive.deleteMany({});

      // 4. Delete all equipment sessions
      const deletedEquipmentSessions =
        await prisma.equipment_sessions.deleteMany({});

      // 5. Delete all book checkouts
      const deletedCheckouts = await prisma.book_checkouts.deleteMany({});

      // 6. Delete student scan stats and rewards
      await prisma.student_scan_stats.deleteMany({});
      await prisma.monthly_rewards.deleteMany({});

      // 7. Delete printing jobs
      await prisma.printing_jobs.deleteMany({});

      // 8. Delete all students
      const deletedStudents = await prisma.students.deleteMany({});

      // 9. Delete all books
      const deletedBooks = await prisma.books.deleteMany({});

      // 10. Delete all equipment
      const deletedEquipment = await prisma.equipment.deleteMany({});

      // 11. Delete library sections BUT recreate default sections
      await prisma.library_sections.deleteMany({});
      
      // Create default library sections that the system expects
      await prisma.library_sections.createMany({
        data: [
          {
            code: 'LIBRARY',
            name: 'Main Library',
            description: 'Main library reading area',
            is_active: true,
          },
          {
            code: 'COMPUTER',
            name: 'Computer Section',
            description: 'Computer and internet access area',
            is_active: true,
          },
          {
            code: 'STUDY',
            name: 'Study Area',
            description: 'Quiet study section',
            is_active: true,
          },
        ],
      });

      // 12. Delete announcements
      await prisma.announcements.deleteMany({});

      // 13. Delete all users EXCEPT the first librarian (keep at least one user)
      const firstUser = await prisma.users.findFirst({
        orderBy: { created_at: 'asc' },
      });

      const deletedUsers = await prisma.users.deleteMany({
        where: {
          id: { not: firstUser?.id || '' },
        },
      });

      logger.warn('☢️ NUCLEAR RESET completed - ALL DATA WIPED', {
        activitiesDeleted: deletedActivities.count,
        equipmentSessionsDeleted: deletedEquipmentSessions.count,
        checkoutsDeleted: deletedCheckouts.count,
        studentsDeleted: deletedStudents.count,
        booksDeleted: deletedBooks.count,
        equipmentDeleted: deletedEquipment.count,
        usersDeleted: deletedUsers.count,
      });

      // Broadcast nuclear reset to all connected clients to refresh their data
      websocketServer.broadcastToAll({
        id: `nuclear_reset_${Date.now()}`,
        type: 'system:nuclear_reset',
        data: {
          message: 'System has been reset. Please refresh your data.',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      });

      return {
        activitiesDeleted: deletedActivities.count,
        equipmentSessionsDeleted: deletedEquipmentSessions.count,
        checkoutsDeleted: deletedCheckouts.count,
        studentsDeleted: deletedStudents.count,
        booksDeleted: deletedBooks.count,
        equipmentDeleted: deletedEquipment.count,
        usersDeleted: deletedUsers.count,
      };
    } catch (error) {
      logger.error('Error in nuclear reset:', error);
      throw error;
    }
  }
}
