import { Router, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { authenticate, authorize } from '@/middleware/auth';
import { getScannerTestService } from '@/services/scannerTestService';
import { getScannerService } from '@/services/usbScannerService';
import { getRealtimeScanProcessor } from '@/services/realtimeScanProcessor';
import { getRedisClient } from '@/utils/redis';
import websocketServer from '@/websocket/websocketServer';

const router = Router();

type ScannerServiceInstance = ReturnType<typeof getScannerService>;
type ScanProcessorInstance = ReturnType<typeof getRealtimeScanProcessor>;
type ScannerTestServiceInstance = ReturnType<typeof getScannerTestService>;

type ScannerTestingDependencies = {
  redis: Redis;
  scannerService: ScannerServiceInstance;
  scanProcessor: ScanProcessorInstance;
  testService: ScannerTestServiceInstance;
};

let dependenciesPromise: Promise<ScannerTestingDependencies> | null = null;

const initializeScannerTestingDependencies =
  async (): Promise<ScannerTestingDependencies> => {
    const redisClient = await getRedisClient();
    const scannerServiceInstance = getScannerService(redisClient);
    const scanProcessorInstance = getRealtimeScanProcessor(
      redisClient,
      scannerServiceInstance,
      websocketServer,
    );
    const testServiceInstance = getScannerTestService(
      redisClient,
      scannerServiceInstance,
      scanProcessorInstance,
    );

    return {
      redis: redisClient,
      scannerService: scannerServiceInstance,
      scanProcessor: scanProcessorInstance,
      testService: testServiceInstance,
    };
  };

const getScannerTestingDependencies =
  async (): Promise<ScannerTestingDependencies> => {
    if (!dependenciesPromise) {
      dependenciesPromise = initializeScannerTestingDependencies().catch(
        error => {
          dependenciesPromise = null;
          logger.error('Failed to initialize scanner testing services', {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        },
      );
    }

    return dependenciesPromise;
  };

const getTestService = async (): Promise<ScannerTestServiceInstance> => {
  const { testService } = await getScannerTestingDependencies();
  return testService;
};

// Get all test scenarios
router.get('/scenarios', authenticate, async (req: Request, res: Response) => {
  try {
    const testService = await getTestService();
    const scenarios = testService.getTestScenarios();

    const response: ApiResponse = {
      success: true,
      data: scenarios,
      timestamp: new Date().toISOString(),
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error getting test scenarios', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
    return;
  }
});

// Get a specific test scenario
router.get(
  '/scenarios/:scenarioId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params;

      if (!scenarioId) {
        res.status(400).json({
          success: false,
          error: 'Scenario ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const testService = await getTestService();

      const scenario = testService.getTestScenario(scenarioId);

      if (scenario) {
        const response: ApiResponse = {
          success: true,
          data: scenario,
          timestamp: new Date().toISOString(),
        };
        return res.json(response);
      }

      res.status(404).json({
        success: false,
        error: 'Test scenario not found',
        timestamp: new Date().toISOString(),
      });
      return;
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
      return;
    }
  },
);

// Create a custom test scenario
router.post(
  '/scenarios',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { name, description, type, config } = req.body;

      if (!name || !type || !config) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, type, config',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const testService = await getTestService();

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
      return;
    } catch (error) {
      logger.error('Error creating test scenario', {
        error: (error as Error).message,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  },
);

// Run a test scenario
router.post(
  '/run/:scenarioId',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params;
      if (!scenarioId) {
        res.status(400).json({
          success: false,
          error: 'Scenario ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const testService = await getTestService();
      const testId = await testService.runTestScenario(scenarioId);

      const response: ApiResponse = {
        success: true,
        message: 'Test started successfully',
        data: { testId, scenarioId },
        timestamp: new Date().toISOString(),
      };

      return res.json(response);
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
      return;
    }
  },
);

// Get test results
router.get(
  '/results/:testId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { testId } = req.params;

      if (!testId) {
        res.status(400).json({
          success: false,
          error: 'Test ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const testService = await getTestService();

      const results = await testService.getTestResults(testId);

      if (results) {
        const response: ApiResponse = {
          success: true,
          data: results,
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      }

      res.status(404).json({
        success: false,
        error: 'Test results not found',
        timestamp: new Date().toISOString(),
      });
      return;
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
      return;
    }
  },
);

// Get all test results
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const testService = await getTestService();
    const results = await testService.getAllTestResults();

    const response: ApiResponse = {
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
    return;
  } catch (error) {
    logger.error('Error getting all test results', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
    return;
  }
});

// Stop an active test
router.post(
  '/stop/:testId',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { testId } = req.params;
      if (!testId) {
        res.status(400).json({
          success: false,
          error: 'Test ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const testService = await getTestService();
      const success = await testService.stopTest(testId);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Test stopped successfully',
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      }

      res.status(404).json({
        success: false,
        error: 'Test not found or already completed',
        timestamp: new Date().toISOString(),
      });
      return;
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
      return;
    }
  },
);

// Delete test results
router.delete(
  '/results/:testId',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { testId } = req.params;
      if (!testId) {
        res.status(400).json({
          success: false,
          error: 'Test ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const testService = await getTestService();
      const success = await testService.deleteTestResults(testId);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Test results deleted successfully',
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      }

      res.status(404).json({
        success: false,
        error: 'Test results not found',
        timestamp: new Date().toISOString(),
      });
      return;
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
      return;
    }
  },
);

// Get simulated devices
router.get(
  '/simulated-devices',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const testService = await getTestService();
      const devices = testService.getSimulatedDevices();

      const response: ApiResponse = {
        success: true,
        data: devices,
        timestamp: new Date().toISOString(),
      };

      return res.json(response);
    } catch (error) {
      logger.error('Error getting simulated devices', {
        error: (error as Error).message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  },
);

// Update simulated device
router.put(
  '/simulated-devices/:deviceId',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const updates = req.body;

      if (!deviceId) {
        res.status(400).json({
          success: false,
          error: 'Device ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const testService = await getTestService();
      const success = testService.updateSimulatedDevice(deviceId, updates);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Simulated device updated successfully',
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      }

      res.status(404).json({
        success: false,
        error: 'Simulated device not found',
        timestamp: new Date().toISOString(),
      });
      return;
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
      return;
    }
  },
);

// Quick test endpoint - run a simple validation test
router.post(
  '/quick-test',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scanCount = 10, scanInterval = 200 } = req.body;

      const testService = await getTestService();

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
      return;
    } catch (error) {
      logger.error('Error running quick test', {
        error: (error as Error).message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  },
);

// Stress test endpoint - run a high-volume performance test
router.post(
  '/stress-test',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const {
        scanCount = 1000,
        scanInterval = 50,
        concurrentDevices = 3,
      } = req.body;

      const testService = await getTestService();

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
      return;
    } catch (error) {
      logger.error('Error running stress test', {
        error: (error as Error).message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  },
);

// Get test system status
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const testService = await getTestService();
    const activeTests = testService.getActiveTestIds();
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
    return;
  } catch (error) {
    logger.error('Error getting test system status', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
    return;
  }
});

export default router;