import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

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
}
