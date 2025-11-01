import { Router, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { authenticate, authorize } from '@/middleware/auth';
import { getScannerService } from '@/services/usbScannerService';
import { getScannerConfigService } from '@/services/scannerConfigService';
import { getRealtimeScanProcessor } from '@/services/realtimeScanProcessor';
import { getRedisClient } from '@/utils/redis';
import websocketServer from '@/websocket/websocketServer';

const router = Router();

type ScannerServiceInstance = ReturnType<typeof getScannerService>;
type ScannerConfigServiceInstance = ReturnType<typeof getScannerConfigService>;
type ScanProcessorInstance = ReturnType<typeof getRealtimeScanProcessor>;

type ScannerDependencies = {
  redis: Redis;
  scannerService: ScannerServiceInstance;
  configService: ScannerConfigServiceInstance;
  scanProcessor: ScanProcessorInstance;
};

let dependenciesPromise: Promise<ScannerDependencies> | null = null;

const initializeScannerDependencies =
  async (): Promise<ScannerDependencies> => {
    const redisClient = await getRedisClient();
    const scannerServiceInstance = getScannerService(redisClient);
    const configServiceInstance = getScannerConfigService(redisClient);
    const scanProcessorInstance = getRealtimeScanProcessor(
      redisClient,
      scannerServiceInstance,
      websocketServer,
    );

    return {
      redis: redisClient,
      scannerService: scannerServiceInstance,
      configService: configServiceInstance,
      scanProcessor: scanProcessorInstance,
    };
  };

const getScannerDependencies = async (): Promise<ScannerDependencies> => {
  if (!dependenciesPromise) {
    dependenciesPromise = initializeScannerDependencies().catch(error => {
      dependenciesPromise = null;
      logger.error('Failed to initialize scanner services', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
  }

  return dependenciesPromise;
};

// Get all scanner devices (both connected and available)
router.get('/devices', authenticate, async (req: Request, res: Response) => {
  try {
    const { scannerService } = await getScannerDependencies();
    const devices = await scannerService.discoverScanners();
    const statuses = scannerService.getScannerStatuses();

    const response: ApiResponse = {
      success: true,
      data: {
        available: devices,
        connected: statuses,
        total: devices.length,
        active: statuses.filter(s => s.connected).length,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
    return;
  } catch (error) {
    logger.error('Error getting scanner devices', {
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

// Connect to a scanner device
router.post(
  '/connect',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scannerService } = await getScannerDependencies();
      const { devicePath, vendorId, productId, name, config } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Scanner name is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const scannerConfig = {
        name,
        enabled: true,
        bufferSize: config?.bufferSize || 64,
        timeout: config?.timeout || 100,
        minLength: config?.minLength || 3,
        maxLength: config?.maxLength || 50,
        beepOnScan: config?.beepOnScan !== false,
        visualFeedback: config?.visualFeedback !== false,
        duplicatePrevention: config?.duplicatePrevention !== false,
        duplicateWindow: config?.duplicateWindow || 30 * 60 * 1000,
        prefix: config?.prefix,
        suffix: config?.suffix,
        devicePath,
        vendorId,
        productId,
      };

      const success = await scannerService.connectScanner(scannerConfig);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Scanner connected successfully',
          data: { config: scannerConfig },
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to connect scanner',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (error) {
      logger.error('Error connecting scanner', {
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

// Disconnect a scanner device
router.post(
  '/disconnect/:deviceId',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scannerService } = await getScannerDependencies();
      const { deviceId } = req.params;

      if (!deviceId) {
        res.status(400).json({
          success: false,
          error: 'Device ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const success = scannerService.disconnectScanner(deviceId);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Scanner disconnected successfully',
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to disconnect scanner or scanner not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (error) {
      logger.error('Error disconnecting scanner', {
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

// Get scanner status for all connected devices
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { scannerService, scanProcessor } = await getScannerDependencies();
    const statuses = scannerService.getScannerStatuses();
    const statistics = scanProcessor.getStatistics();

    const response: ApiResponse = {
      success: true,
      data: {
        scanners: statuses,
        statistics,
        totalConnected: statuses.filter(s => s.connected).length,
        lastScan: statistics.lastScanTime,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
    return;
  } catch (error) {
    logger.error('Error getting scanner status', {
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

// Get status for a specific scanner
router.get(
  '/status/:deviceId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { scannerService } = await getScannerDependencies();
      const { deviceId } = req.params;

      if (!deviceId) {
        res.status(400).json({
          success: false,
          error: 'Device ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const status = scannerService.getScannerStatus(deviceId);

      if (status) {
        const response: ApiResponse = {
          success: true,
          data: status,
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      } else {
        res.status(404).json({
          success: false,
          error: 'Scanner not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (error) {
      logger.error('Error getting scanner status', {
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

// Enable/disable a scanner
router.post(
  '/enable/:deviceId',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scannerService } = await getScannerDependencies();
      const { deviceId } = req.params;
      const { enabled } = req.body;

      if (!deviceId) {
        res.status(400).json({
          success: false,
          error: 'Device ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'enabled field must be a boolean',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const success = scannerService.setScannerEnabled(deviceId, enabled);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: `Scanner ${enabled ? 'enabled' : 'disabled'} successfully`,
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to update scanner or scanner not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (error) {
      logger.error('Error updating scanner enabled status', {
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

// Update scanner configuration
router.put(
  '/config/:deviceId',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scannerService } = await getScannerDependencies();
      const { deviceId } = req.params;
      const config = req.body;

      if (!deviceId) {
        res.status(400).json({
          success: false,
          error: 'Device ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const success = scannerService.updateScannerConfig(deviceId, config);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Scanner configuration updated successfully',
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to update scanner configuration or scanner not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (error) {
      logger.error('Error updating scanner configuration', {
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
  },
);

// Auto-configure scanner for detected device
router.post(
  '/auto-configure',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scannerService, configService } = await getScannerDependencies();
      const { devicePath, vendorId, productId } = req.body;

      // First, discover the device
      const devices = await scannerService.discoverScanners();
      let targetDevice = devices.find(device => device.path === devicePath);

      if (!targetDevice && vendorId && productId) {
        targetDevice = devices.find(
          device =>
            device.vendorId === vendorId && device.productId === productId,
        );
      }

      if (!targetDevice) {
        res.status(404).json({
          success: false,
          error: 'Scanner device not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Auto-configure based on device
      const configs = await configService.autoConfigureScanner(targetDevice);

      if (configs.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No suitable configuration found for this device',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [primaryConfig] = configs;
      if (!primaryConfig) {
        res.status(500).json({
          success: false,
          error: 'Unable to apply auto-configuration',
          data: { configs },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const success = await scannerService.connectScanner(primaryConfig);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Scanner auto-configured and connected successfully',
          data: {
            device: targetDevice,
            configs,
            activeConfig: primaryConfig,
          },
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Failed to connect with auto-configured settings',
        data: { configs },
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error) {
      logger.error('Error auto-configuring scanner', {
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

// Get scan processor statistics
router.get('/statistics', authenticate, async (req: Request, res: Response) => {
  try {
    const { scanProcessor } = await getScannerDependencies();
    const statistics = scanProcessor.getStatistics();
    const config = scanProcessor.getConfig();

    const response: ApiResponse = {
      success: true,
      data: {
        statistics,
        config,
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error getting scan statistics', {
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

// Reset scan statistics
router.post(
  '/statistics/reset',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scanProcessor } = await getScannerDependencies();
      scanProcessor.resetStatistics();

      const response: ApiResponse = {
        success: true,
        message: 'Scan statistics reset successfully',
        timestamp: new Date().toISOString(),
      };

      res.json(response);
      return;
    } catch (error) {
      logger.error('Error resetting scan statistics', {
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

// Update scan processor configuration
router.put(
  '/processor/config',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { scanProcessor } = await getScannerDependencies();
      const config = req.body;

      scanProcessor.updateConfig(config);

      const response: ApiResponse = {
        success: true,
        message: 'Scan processor configuration updated successfully',
        data: scanProcessor.getConfig(),
        timestamp: new Date().toISOString(),
      };

      res.json(response);
      return;
    } catch (error) {
      logger.error('Error updating scan processor configuration', {
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

// Process manual scan (for testing or manual input)
router.post('/manual', authenticate, async (req: Request, res: Response) => {
  try {
    const { scanProcessor } = await getScannerDependencies();
    const { data, deviceId = 'manual' } = req.body;

    if (!data || typeof data !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Scan data is required and must be a string',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await scanProcessor.processManualScan(data, deviceId);

    const response: ApiResponse = {
      success: true,
      message: 'Manual scan processed successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
    return;
  } catch (error) {
    logger.error('Error processing manual scan', {
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
});

// Get scanner stations
router.get('/stations', authenticate, async (req: Request, res: Response) => {
  try {
    const { configService } = await getScannerDependencies();
    const stations = configService.getStations();

    const response: ApiResponse = {
      success: true,
      data: stations,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error getting scanner stations', {
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

// Create scanner station
router.post(
  '/stations',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { configService } = await getScannerDependencies();
      const { name, location, description, scannerConfigs } = req.body;

      if (!name || !location) {
        res.status(400).json({
          success: false,
          error: 'Name and location are required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const station = await configService.createStation({
        name,
        location,
        description,
        scannerConfigs: scannerConfigs || [],
        isActive: true,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Scanner station created successfully',
        data: station,
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
      return;
    } catch (error) {
      logger.error('Error creating scanner station', {
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

// Update scanner station
router.put(
  '/stations/:stationId',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { configService } = await getScannerDependencies();
      const { stationId } = req.params;
      const updates = req.body;

      if (!stationId) {
        res.status(400).json({
          success: false,
          error: 'Station ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const station = await configService.updateStation(stationId, updates);

      if (station) {
        const response: ApiResponse = {
          success: true,
          message: 'Scanner station updated successfully',
          data: station,
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      }

      res.status(404).json({
        success: false,
        error: 'Scanner station not found',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error) {
      logger.error('Error updating scanner station', {
        error: (error as Error).message,
        stationId: req.params.stationId,
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

// Delete scanner station
router.delete(
  '/stations/:stationId',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { configService } = await getScannerDependencies();
      const { stationId } = req.params;

      if (!stationId) {
        res.status(400).json({
          success: false,
          error: 'Station ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const success = await configService.deleteStation(stationId);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: 'Scanner station deleted successfully',
          timestamp: new Date().toISOString(),
        };
        res.json(response);
        return;
      }

      res.status(404).json({
        success: false,
        error: 'Scanner station not found',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error) {
      logger.error('Error deleting scanner station', {
        error: (error as Error).message,
        stationId: req.params.stationId,
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

// Get scanner profiles
router.get('/profiles', authenticate, async (req: Request, res: Response) => {
  try {
    const { configService } = await getScannerDependencies();
    const profiles = configService.getProfiles();

    const response: ApiResponse = {
      success: true,
      data: profiles,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error getting scanner profiles', {
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

// Apply scanner profile to device
router.post(
  '/profiles/:profileId/apply',
  authenticate,
  authorize(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { configService } = await getScannerDependencies();
      const { profileId } = req.params;
      const { baseConfig } = req.body;

      if (!profileId) {
        res.status(400).json({
          success: false,
          error: 'Profile ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!baseConfig) {
        res.status(400).json({
          success: false,
          error: 'Base configuration is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const config = configService.applyProfile(profileId, baseConfig);

      const response: ApiResponse = {
        success: true,
        message: 'Profile applied successfully',
        data: config,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
      return;
    } catch (error) {
      logger.error('Error applying scanner profile', {
        error: (error as Error).message,
        profileId: req.params.profileId,
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

export default router;
