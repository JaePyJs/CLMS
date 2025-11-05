import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { SettingsService } from '../services/settingsService';
import { logger } from '../utils/logger';

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
        userId: req.user!.userId,
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
        userId: req.user!.userId,
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
        userId: req.user!.userId,
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
        userId: req.user!.userId,
      });

      const success = await SettingsService.updateSetting(
        key,
        value,
        req.user!.userId,
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
        userId: req.user!.userId,
      });

      const success = await SettingsService.updateSettings(
        settings,
        req.user!.userId,
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
        userId: req.user!.userId,
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

export default router;
