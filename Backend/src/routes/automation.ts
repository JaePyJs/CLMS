import { Router, Request, Response } from 'express';
import { automationService } from '@/services/automation';
import { googleSheetsService } from '@/services/googleSheets';
import { ApiResponse } from '@/types';

const router = Router();

// Get all automation jobs
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await automationService.getAllJobs();

    const response: ApiResponse = {
      success: true,
      data: jobs,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch automation jobs',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get specific job status
router.get(
  '/jobs/:id',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      const job = await automationService.getJobStatus(id || '');

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse = {
        success: true,
        data: job,
        timestamp: new Date().toISOString(),
      };

      return res.json(response);
    } catch (_error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch job status',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Trigger job manually
router.post(
  '/jobs/:id/trigger',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      await automationService.triggerJob(id || '');

      const response: ApiResponse = {
        success: true,
        message: 'Job triggered successfully',
        timestamp: new Date().toISOString(),
      };

      return res.json(response);
    } catch (_error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to trigger job',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Get queue status
router.get('/queues/status', async (req: Request, res: Response) => {
  try {
    const queueStatus = await automationService.getQueueStatus();

    const response: ApiResponse = {
      success: true,
      data: queueStatus,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue status',
      timestamp: new Date().toISOString(),
    });
  }
});

// Test Google Sheets connection
router.get('/google-sheets/test', async (req: Request, res: Response) => {
  try {
    const isConnected = await googleSheetsService.testConnection();

    const response: ApiResponse = {
      success: isConnected,
      data: {
        connected: isConnected,
        spreadsheetInfo: googleSheetsService.getSpreadsheetInfo(),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Google Sheets connection test failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Generate daily report
router.get('/reports/daily', async (req: Request, res: Response) => {
  try {
    const date = req.query.date
      ? new Date(req.query.date as string)
      : new Date();
    const report = await googleSheetsService.generateDailyReport(date);

    const response: ApiResponse = {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate daily report',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
