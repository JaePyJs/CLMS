import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { authenticate, authorize } from '@/middleware/auth';
import { getScannerTestService } from '@/services/scannerTestService';
import { getScannerService } from '@/services/usbScannerService';
import { getRealtimeScanProcessor } from '@/services/realtimeScanProcessor';
import { getRedisClient } from '@/utils/redis';

const router = Router();

// Initialize services
const redis = getRedisClient();
const scannerService = getScannerService(redis);
const scanProcessor = getRealtimeScanProcessor(redis, scannerService, new (require('@/websocket/websocketServer')).WebSocketServer());
const testService = getScannerTestService(redis, scannerService, scanProcessor);

// Get all test scenarios
router.get('/scenarios', authenticate, async (req: Request, res: Response) => {
  try {
    const scenarios = testService.getTestScenarios();

    const response: ApiResponse = {
      success: true,
      data: scenarios,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting test scenarios', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get a specific test scenario
router.get('/scenarios/:scenarioId', authenticate, async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;

    const scenario = testService.getTestScenario(scenarioId);

    if (scenario) {
      const response: ApiResponse = {
        success: true,
        data: scenario,
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        error: 'Test scenario not found',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error getting test scenario', {
      error: (error as Error).message,
      scenarioId: req.params.scenarioId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Create a custom test scenario
router.post('/scenarios', authenticate, authorize(['ADMIN', 'LIBRARIAN']), async (req: Request, res: Response) => {
  try {
    const { name, description, type, config } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, type, config',
        timestamp: new Date().toISOString(),
      });
    }

    const scenario = testService.createTestScenario({
      name,
      description,
      type,
      config,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Test scenario created successfully',
      data: scenario,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating test scenario', { error: (error as Error).message, body: req.body });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Run a test scenario
router.post('/run/:scenarioId', authenticate, authorize(['ADMIN', 'LIBRARIAN']), async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;

    const testId = await testService.runTestScenario(scenarioId);

    const response: ApiResponse = {
      success: true,
      message: 'Test started successfully',
      data: { testId, scenarioId },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error running test scenario', {
      error: (error as Error).message,
      scenarioId: req.params.scenarioId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get test results
router.get('/results/:testId', authenticate, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const results = await testService.getTestResults(testId);

    if (results) {
      const response: ApiResponse = {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        error: 'Test results not found',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error getting test results', {
      error: (error as Error).message,
      testId: req.params.testId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get all test results
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const results = await testService.getAllTestResults();

    const response: ApiResponse = {
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting all test results', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Stop an active test
router.post('/stop/:testId', authenticate, authorize(['ADMIN', 'LIBRARIAN']), async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const success = await testService.stopTest(testId);

    if (success) {
      const response: ApiResponse = {
        success: true,
        message: 'Test stopped successfully',
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        error: 'Test not found or already completed',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error stopping test', {
      error: (error as Error).message,
      testId: req.params.testId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete test results
router.delete('/results/:testId', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const success = await testService.deleteTestResults(testId);

    if (success) {
      const response: ApiResponse = {
        success: true,
        message: 'Test results deleted successfully',
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        error: 'Test results not found',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error deleting test results', {
      error: (error as Error).message,
      testId: req.params.testId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get simulated devices
router.get('/simulated-devices', authenticate, async (req: Request, res: Response) => {
  try {
    const devices = testService.getSimulatedDevices();

    const response: ApiResponse = {
      success: true,
      data: devices,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting simulated devices', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Update simulated device
router.put('/simulated-devices/:deviceId', authenticate, authorize(['ADMIN', 'LIBRARIAN']), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const updates = req.body;

    const success = testService.updateSimulatedDevice(deviceId, updates);

    if (success) {
      const response: ApiResponse = {
        success: true,
        message: 'Simulated device updated successfully',
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        error: 'Simulated device not found',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error updating simulated device', {
      error: (error as Error).message,
      deviceId: req.params.deviceId,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Quick test endpoint - run a simple validation test
router.post('/quick-test', authenticate, authorize(['ADMIN', 'LIBRARIAN']), async (req: Request, res: Response) => {
  try {
    const { scanCount = 10, scanInterval = 200 } = req.body;

    // Create a quick test scenario
    const scenario = testService.createTestScenario({
      name: 'Quick Validation Test',
      description: 'Quick test to validate scanner functionality',
      type: 'basic_scan',
      config: {
        scanCount,
        scanInterval,
        dataTypes: ['student', 'book'],
        errorRate: 0.1,
        duplicateRate: 0.05,
      },
    });

    // Run the test
    const testId = await testService.runTestScenario(scenario.id);

    const response: ApiResponse = {
      success: true,
      message: 'Quick test started successfully',
      data: { testId, scenarioId: scenario.id },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error running quick test', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Stress test endpoint - run a high-volume performance test
router.post('/stress-test', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { scanCount = 1000, scanInterval = 50, concurrentDevices = 3 } = req.body;

    // Create a stress test scenario
    const scenario = testService.createTestScenario({
      name: 'Stress Test',
      description: 'High-volume performance stress test',
      type: 'device_simulation',
      config: {
        scanCount,
        scanInterval,
        dataTypes: ['student', 'book', 'equipment'],
        errorRate: 0.02,
        duplicateRate: 0.03,
        concurrentDevices,
      },
    });

    // Run the test
    const testId = await testService.runTestScenario(scenario.id);

    const response: ApiResponse = {
      success: true,
      message: 'Stress test started successfully',
      data: { testId, scenarioId: scenario.id },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error running stress test', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get test system status
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const activeTests = Array.from((testService as any).activeTests?.keys() || []);
    const simulatedDevices = testService.getSimulatedDevices();
    const scenarios = testService.getTestScenarios();

    const response: ApiResponse = {
      success: true,
      data: {
        activeTests,
        activeTestCount: activeTests.length,
        simulatedDeviceCount: simulatedDevices.length,
        scenarioCount: scenarios.length,
        simulatedDevices,
        systemStatus: 'ready',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting test system status', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;