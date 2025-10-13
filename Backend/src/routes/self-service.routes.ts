import express from 'express';
import { selfServiceService } from '../services/self-service.service';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// All routes require authentication (librarian must be logged in)
router.use(authMiddleware);

/**
 * @route   POST /api/self-service/scan
 * @desc    Process a student scan (auto check-in or check-out)
 * @access  Private (requires auth)
 */
router.post('/scan', async (req, res) => {
  try {
    const { scanData } = req.body;

    if (!scanData) {
      return res.status(400).json({
        success: false,
        message: 'Scan data is required',
      });
    }

    // Get student status first
    const status = await selfServiceService.getStudentStatus(scanData);

    if (!status.success || !status.student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please verify the ID.',
      });
    }

    // If checked in, check them out
    if (status.isCheckedIn) {
      const result = await selfServiceService.checkOut(scanData);
      return res.json(result);
    }

    // If not checked in, check them in
    const result = await selfServiceService.checkIn(scanData);
    return res.json(result);
  } catch (error) {
    console.error('Error processing scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process scan',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/self-service/status/:scanData
 * @desc    Get student status (checked in, cooldown, etc.)
 * @access  Private (requires auth)
 */
router.get('/status/:scanData', async (req, res) => {
  try {
    const { scanData } = req.params;

    const status = await selfServiceService.getStudentStatus(scanData);
    res.json(status);
  } catch (error) {
    console.error('Error getting student status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/self-service/check-in
 * @desc    Check in a student
 * @access  Private (requires auth)
 */
router.post('/check-in', async (req, res) => {
  try {
    const { scanData } = req.body;

    if (!scanData) {
      return res.status(400).json({
        success: false,
        message: 'Scan data is required',
      });
    }

    const result = await selfServiceService.checkIn(scanData);
    res.json(result);
  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in student',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/self-service/check-out
 * @desc    Check out a student
 * @access  Private (requires auth)
 */
router.post('/check-out', async (req, res) => {
  try {
    const { scanData } = req.body;

    if (!scanData) {
      return res.status(400).json({
        success: false,
        message: 'Scan data is required',
      });
    }

    const result = await selfServiceService.checkOut(scanData);
    res.json(result);
  } catch (error) {
    console.error('Error during check-out:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check out student',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/self-service/statistics
 * @desc    Get self-service usage statistics
 * @access  Private (requires auth)
 */
router.get('/statistics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const stats = await selfServiceService.getStatistics(start, end);
    res.json(stats);
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
