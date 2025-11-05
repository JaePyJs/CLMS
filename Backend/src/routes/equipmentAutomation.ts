import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { EquipmentAutomationService } from '../services/equipmentAutomationService.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/equipment/automation/statistics
 * Get equipment usage statistics
 */
router.get(
  '/statistics',
  asyncHandler(async (_req, res) => {
    const statistics = await EquipmentAutomationService.getUsageStatistics();

    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * GET /api/equipment/automation/overdue
 * Get all overdue equipment
 */
router.get(
  '/overdue',
  asyncHandler(async (_req, res) => {
    const overdue = await EquipmentAutomationService.getOverdueEquipment();

    res.json({
      success: true,
      data: overdue,
      count: overdue.length,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * GET /api/equipment/automation/maintenance
 * Get equipment maintenance schedule
 */
router.get(
  '/maintenance',
  asyncHandler(async (_req, res) => {
    const maintenance =
      await EquipmentAutomationService.getMaintenanceSchedule();

    res.json({
      success: true,
      data: maintenance,
      count: maintenance.length,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * GET /api/equipment/automation/analytics
 * Get equipment usage analytics
 */
router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await EquipmentAutomationService.getUsageAnalytics(days);

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * POST /api/equipment/automation/notifications/overdue
 * Send overdue notifications
 */
router.post(
  '/notifications/overdue',
  asyncHandler(async (_req, res) => {
    const result = await EquipmentAutomationService.sendOverdueNotifications();

    res.json({
      success: true,
      data: result,
      message: `Sent ${result.sent} overdue notifications (${result.failed} failed)`,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * POST /api/equipment/automation/maintenance/schedule
 * Schedule maintenance reminders
 */
router.post(
  '/maintenance/schedule',
  asyncHandler(async (_req, res) => {
    const scheduled =
      await EquipmentAutomationService.scheduleMaintenanceReminders();

    res.json({
      success: true,
      data: { scheduled },
      message: `Scheduled ${scheduled} maintenance reminders`,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * POST /api/equipment/automation/auto-return
 * Auto-return overdue equipment (admin only)
 */
router.post(
  '/auto-return',
  asyncHandler(async (_req, res) => {
    const result =
      await EquipmentAutomationService.autoReturnOverdueEquipment();

    res.json({
      success: true,
      data: result,
      message: `Auto-returned ${result.returned} overdue equipment (${result.errors} errors)`,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * POST /api/equipment/automation/run-cycle
 * Run complete automation cycle
 */
router.post(
  '/run-cycle',
  asyncHandler(async (_req, res) => {
    const result = await EquipmentAutomationService.runAutomationCycle();

    res.json({
      success: true,
      data: result,
      message: 'Automation cycle completed successfully',
      timestamp: new Date().toISOString(),
    });
  }),
);

export default router;
