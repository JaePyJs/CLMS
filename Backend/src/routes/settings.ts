import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { SettingsService } from '../services/settingsService';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';
import { prisma } from '../utils/prisma';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// GET /api/settings - Get all settings
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      logger.info('Get all settings request', {
        userId: req.user.userId,
      });

      const settings = await SettingsService.getAllSettings();

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      logger.error('Error getting settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve settings',
      });
    }
  }),
);

// GET /api/settings/category/:category - Get settings by category
router.get(
  '/category/:category',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { category } = req.params;

      logger.info('Get settings by category', {
        category,
        userId: req.user.userId,
      });

      const settings = await SettingsService.getSettingsByCategory(category);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      logger.error('Error getting settings by category', {
        category: req.params.category,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve settings',
      });
    }
  }),
);

// GET /api/settings/system - Get system configuration object
router.get(
  '/system',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      logger.info('Get system settings object', {
        userId: req.user.userId,
      });

      const settings = await SettingsService.getSettingsByCategory('system');

      // Transform array to object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: Record<string, any> = {};

      // Default values
      config.libraryName = 'School Library';
      config.fineRatePerDay = 5.0;
      config.defaultCheckoutPeriod = 7;
      config.overdueGracePeriod = 0;
      config.maxBooksPerStudent = 5;
      config.sessionTimeout = 30;
      config.libraryHours = { open: '08:00', close: '18:00' };
      config.sessionLimits = {
        PRIMARY: 30,
        GRADE_SCHOOL: 60,
        JUNIOR_HIGH: 90,
        SENIOR_HIGH: 120,
      };

      settings.forEach(s => {
        try {
          if (s.key === 'libraryHours' || s.key === 'sessionLimits') {
            config[s.key] = JSON.parse(s.value);
          } else if (
            [
              'fineRatePerDay',
              'defaultCheckoutPeriod',
              'overdueGracePeriod',
              'maxBooksPerStudent',
              'sessionTimeout',
            ].includes(s.key)
          ) {
            config[s.key] = Number(s.value);
          } else {
            config[s.key] = s.value;
          }
        } catch (e) {
          logger.warn(`Failed to parse setting ${s.key}`, { error: e });
        }
      });

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Error getting system settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve system settings',
      });
    }
  }),
);

// PUT /api/settings/system - Update system configuration object
router.put(
  '/system',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const config = req.body;
      logger.info('Update system settings object', {
        userId: req.user.userId,
        configKeys: Object.keys(config),
      });

      // Update each setting
      const updates = [];
      for (const [key, value] of Object.entries(config)) {
        let stringValue = String(value);
        if (typeof value === 'object') {
          stringValue = JSON.stringify(value);
        }

        updates.push(
          SettingsService.updateSetting(
            key,
            stringValue,
            req.user.userId,
            'system',
          ),
        );
      }

      await Promise.all(updates);

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Error updating system settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update system settings',
      });
    }
  }),
);

// POST /api/settings/system/reset - Reset system settings to defaults
router.post(
  '/system/reset',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Single-user system: any authenticated user can reset settings
    try {
      logger.info('Reset system settings to defaults', {
        userId: req.user.userId,
        role: req.user.role,
      });

      // Default system settings
      const defaultSettings = {
        libraryName: 'SHJCS Library',
        libraryTagline: 'Where Knowledge Meets Excellence',
        maxBorrowDays: '14',
        maxBooksPerStudent: '3',
        overdueGracePeriod: '0',
        cooldownMinutes: '0',
        defaultCheckInDuration: '30',
        operatingHoursStart: '07:00',
        operatingHoursEnd: '17:00',
        theme: 'system',
        dateFormat: 'MMM d, yyyy',
        timeFormat: 'h:mm a',
      };

      // Update each setting to defaults
      const updates = [];
      for (const [key, value] of Object.entries(defaultSettings)) {
        updates.push(
          SettingsService.updateSetting(key, value, req.user.userId, 'system'),
        );
      }

      await Promise.all(updates);

      res.json({
        success: true,
        message: 'System settings reset to defaults',
        data: defaultSettings,
      });
    } catch (error) {
      logger.error('Error resetting system settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to reset system settings',
      });
    }
  }),
);

// ============================================
// Google Sheets Configuration Routes
// IMPORTANT: These must be defined BEFORE dynamic /:key routes
// ============================================

// GET /api/settings/google-sheets - Get Google Sheets configuration
router.get(
  '/google-sheets',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      // Return current Google Sheets configuration
      const settings =
        await SettingsService.getSettingsByCategory('google-sheets');

      res.json({
        success: true,
        data: {
          enabled: false,
          spreadsheetId:
            settings.find(s => s.key === 'spreadsheet_id')?.value || '',
          syncSchedule:
            settings.find(s => s.key === 'sync_schedule')?.value || 'manual',
          lastSync: null,
          status: 'not_configured',
        },
      });
    } catch (error) {
      logger.error('Error getting Google Sheets config', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get Google Sheets configuration',
      });
    }
  }),
);

// PUT /api/settings/google-sheets/schedule - Update sync schedule
router.put(
  '/google-sheets/schedule',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { schedule, spreadsheetId } = req.body;

      // Store settings
      if (spreadsheetId) {
        await SettingsService.updateSetting(
          'spreadsheet_id',
          spreadsheetId,
          'google-sheets',
        );
      }
      if (schedule) {
        await SettingsService.updateSetting(
          'sync_schedule',
          schedule,
          'google-sheets',
        );
      }

      res.json({
        success: true,
        message: 'Google Sheets schedule updated',
      });
    } catch (error) {
      logger.error('Error updating Google Sheets schedule', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update schedule',
      });
    }
  }),
);

// POST /api/settings/google-sheets/test - Test connection
router.post(
  '/google-sheets/test',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { spreadsheetId } = req.body;

      // For now, return a placeholder response
      // Full implementation would test actual Google Sheets API connection
      res.json({
        success: true,
        message: 'Connection test feature not fully implemented',
        data: {
          connected: false,
          spreadsheetId,
        },
      });
    } catch (error) {
      logger.error('Error testing Google Sheets connection', { error });
      res.status(500).json({
        success: false,
        message: 'Connection test failed',
      });
    }
  }),
);

// POST /api/settings/google-sheets/sync - Trigger manual sync
router.post(
  '/google-sheets/sync',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      // Placeholder for sync functionality
      res.json({
        success: true,
        message: 'Google Sheets sync feature not fully implemented',
        data: {
          synced: false,
        },
      });
    } catch (error) {
      logger.error('Error syncing Google Sheets', { error });
      res.status(500).json({
        success: false,
        message: 'Sync failed',
      });
    }
  }),
);

// ============================================
// Dynamic Key Routes - MUST BE LAST
// ============================================

// GET /api/settings/:key - Get a specific setting
router.get(
  '/:key',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { key } = req.params;

      logger.info('Get setting by key', {
        key,
        userId: req.user.userId,
      });

      const value = await SettingsService.getSetting(key);

      if (value === null) {
        res.status(404).json({
          success: false,
          message: 'Setting not found',
        });
        return;
      }

      res.json({
        success: true,
        data: { key, value },
      });
    } catch (error) {
      logger.error('Error getting setting', {
        key: req.params.key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve setting',
      });
    }
  }),
);

// PUT /api/settings/:key - Update a specific setting
router.put(
  '/:key',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { key } = req.params;
      const { value } = req.body;

      if (!value) {
        res.status(400).json({
          success: false,
          message: 'Value is required',
        });
        return;
      }

      logger.info('Update setting', {
        key,
        value,
        userId: req.user.userId,
      });

      const success = await SettingsService.updateSetting(
        key,
        value,
        req.user.userId,
      );

      if (!success) {
        res.status(500).json({
          success: false,
          message: 'Failed to update setting',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Setting updated successfully',
      });
    } catch (error) {
      logger.error('Error updating setting', {
        key: req.params.key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update setting',
      });
    }
  }),
);

// POST /api/settings/batch - Update multiple settings
router.post(
  '/batch',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { settings } = req.body;

      if (!settings || !Array.isArray(settings)) {
        res.status(400).json({
          success: false,
          message: 'Settings array is required',
        });
        return;
      }

      logger.info('Update multiple settings', {
        count: settings.length,
        userId: req.user.userId,
      });

      const success = await SettingsService.updateSettings(
        settings,
        req.user.userId,
      );

      if (!success) {
        res.status(500).json({
          success: false,
          message: 'Failed to update settings',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      logger.error('Error updating multiple settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update settings',
      });
    }
  }),
);

// POST /api/settings/initialize - Initialize default settings
router.post(
  '/initialize',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      logger.info('Initialize default settings', {
        userId: req.user.userId,
      });

      await SettingsService.initializeDefaultSettings();

      res.json({
        success: true,
        message: 'Default settings initialized successfully',
      });
    } catch (error) {
      logger.error('Error initializing default settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to initialize settings',
      });
    }
  }),
);

// POST /api/settings/reset-daily-data - Reset today's check-ins, sessions, etc.
router.post(
  '/reset-daily-data',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Single-user system: any authenticated user can reset daily data
    if (!req.user) {
      res.status(403).json({ error: 'Authentication required' });
      return;
    }

    try {
      logger.info('Reset daily data request', {
        userId: req.user.userId,
        role: req.user.role,
      });

      const { deleteTodaysActivities } = req.body || {};
      const result = await SettingsService.resetDailyData(
        Boolean(deleteTodaysActivities),
      );

      // Compute updated overview data and broadcast it so WS clients update immediately
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const overviewData = {
          totalStudents: await prisma.students.count(),
          activeStudents: await prisma.student_activities.count({
            where: { status: 'ACTIVE' },
          }),
          totalBooks: await prisma.books.count(),
          activeBorrows: await prisma.book_checkouts.count({
            where: { status: 'ACTIVE' },
          }),
          overdueBorrows: await prisma.book_checkouts.count({
            where: { status: 'ACTIVE', due_date: { lt: new Date() } },
          }),
          todayActivities: await prisma.student_activities.count({
            where: { start_time: { gte: startOfDay } },
          }),
          activeEquipment: await prisma.equipment.count({
            where: { status: 'IN_USE' },
          }),
          activeConnections: 0,
          systemLoad: 0,
        };

        websocketServer.broadcastToRoom('dashboard', {
          id: `overview-${Date.now()}`,
          type: 'dashboard_data',
          data: overviewData,
          timestamp: new Date(),
        });
      } catch (e) {
        logger.warn('Failed to broadcast dashboard update after daily reset', {
          error: e instanceof Error ? e.message : 'Unknown',
        });
      }

      res.json({
        success: true,
        message: 'Daily data reset successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error resetting daily data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to reset daily data',
      });
    }
  }),
);

// POST /api/settings/reset-all-data - Reset ALL data (nuclear option)
router.post(
  '/reset-all-data',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Single-user system: any authenticated user can reset data
    if (!req.user) {
      res.status(403).json({ error: 'Authentication required' });
      return;
    }

    const { confirmationCode } = req.body;

    // Require confirmation code to prevent accidental resets
    if (confirmationCode !== 'RESET-ALL-DATA-CONFIRM') {
      res.status(400).json({
        success: false,
        message:
          'Invalid confirmation code. Send { confirmationCode: "RESET-ALL-DATA-CONFIRM" } to proceed.',
      });
      return;
    }

    try {
      logger.warn('⚠️ RESET ALL DATA request initiated', {
        userId: req.user.userId,
        role: req.user.role,
        timestamp: new Date().toISOString(),
      });

      const result = await SettingsService.resetAllData();

      // Broadcast updated overview to dashboard
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const overviewData = {
          totalStudents: await prisma.students.count(),
          activeStudents: await prisma.student_activities.count({
            where: { status: 'ACTIVE' },
          }),
          totalBooks: await prisma.books.count(),
          activeBorrows: await prisma.book_checkouts.count({
            where: { status: 'ACTIVE' },
          }),
          overdueBorrows: await prisma.book_checkouts.count({
            where: { status: 'ACTIVE', due_date: { lt: new Date() } },
          }),
          todayActivities: await prisma.student_activities.count({
            where: { start_time: { gte: startOfDay } },
          }),
          activeEquipment: await prisma.equipment.count({
            where: { status: 'IN_USE' },
          }),
          activeConnections: 0,
          systemLoad: 0,
        };
        websocketServer.broadcastToRoom('dashboard', {
          id: `overview-${Date.now()}`,
          type: 'dashboard_data',
          data: overviewData,
          timestamp: new Date(),
        });
      } catch (err) {
        logger.warn('Failed to broadcast dashboard update after full reset', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }

      res.json({
        success: true,
        message: 'All data reset successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error resetting all data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to reset all data',
      });
    }
  }),
);

// POST /api/settings/nuclear-reset - COMPLETE database wipe (for testing)
router.post(
  '/nuclear-reset',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Allow any authenticated librarian to perform nuclear reset
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { confirmationCode } = req.body;

    // Require very specific confirmation code
    if (confirmationCode !== 'NUCLEAR-RESET-CONFIRM-DELETE-EVERYTHING') {
      res.status(400).json({
        success: false,
        message:
          'Invalid confirmation code. Send { confirmationCode: "NUCLEAR-RESET-CONFIRM-DELETE-EVERYTHING" } to proceed.',
      });
      return;
    }

    try {
      logger.warn('☢️ NUCLEAR RESET request initiated', {
        userId: req.user.userId,
        role: req.user.role,
        timestamp: new Date().toISOString(),
      });

      const result = await SettingsService.nuclearReset();

      // Broadcast updated overview to dashboard
      try {
        const overviewData = {
          totalStudents: 0,
          activeStudents: 0,
          totalBooks: 0,
          activeBorrows: 0,
          overdueBorrows: 0,
          todayActivities: 0,
          activeEquipment: 0,
          activeConnections: 0,
          systemLoad: 0,
        };
        websocketServer.broadcastToRoom('dashboard', {
          id: `overview-${Date.now()}`,
          type: 'dashboard_data',
          data: overviewData,
          timestamp: new Date(),
        });
      } catch (err) {
        logger.warn(
          'Failed to broadcast dashboard update after nuclear reset',
          {
            error: err instanceof Error ? err.message : 'Unknown',
          },
        );
      }

      res.json({
        success: true,
        message: 'Nuclear reset completed - all data wiped',
        data: result,
      });
    } catch (error) {
      logger.error('Error in nuclear reset', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to perform nuclear reset',
      });
    }
  }),
);

export default router;
