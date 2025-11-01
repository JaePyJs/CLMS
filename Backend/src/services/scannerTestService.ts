import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { Redis } from 'ioredis';
import { USBScannerService } from './usbScannerService';
import { RealtimeScanProcessor } from './realtimeScanProcessor';

// Test scenario types
export type TestScenarioType =
  | 'basic_scan'
  | 'bulk_scan'
  | 'error_handling'
  | 'performance'
  | 'duplicate_detection'
  | 'device_simulation';

// Test data generators
interface TestDataGenerator {
  generateStudentId(): string;
  generateBookBarcode(): string;
  generateEquipmentTag(): string;
  generateInvalidBarcode(): string;
  generateQRCode(): string;
}

// Test scenario interface
export interface TestScenario {
  id: string;
  name: string;
  description: string;
  type: TestScenarioType;
  config: TestScenarioConfig;
}

// Test scenario configuration
export interface TestScenarioConfig {
  scanCount: number;
  scanInterval: number; // in milliseconds
  dataTypes: ('student' | 'book' | 'equipment' | 'invalid')[];
  errorRate?: number; // 0-1
  duplicateRate?: number; // 0-1
  duration?: number; // in milliseconds
  concurrentDevices?: number;
}

// Test results
export interface TestResults {
  scenarioId: string;
  scenarioName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  duplicateScans: number;
  invalidScans: number;
  averageProcessingTime: number;
  throughput: number; // scans per second
  errors: TestError[];
  deviceResults: Map<string, DeviceTestResults>;
}

// Test error
export interface TestError {
  timestamp: Date;
  deviceId: string;
  error: string;
  data: string;
  context?: Record<string, unknown>;
}

// Device test results
export interface DeviceTestResults {
  deviceId: string;
  deviceName: string;
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  averageScanTime: number;
  lastScanTime: Date | null;
}

// Simulated device
export interface SimulatedDevice {
  id: string;
  name: string;
  type: 'usb_scanner' | 'qr_scanner' | 'mobile_scanner';
  vendorId: number;
  productId: number;
  enabled: boolean;
  scanInterval: number;
  errorRate: number;
}

export class ScannerTestService extends EventEmitter {
  private redis: Redis;
  private scannerService: USBScannerService;
  private scanProcessor: RealtimeScanProcessor;
  private testScenarios: Map<string, TestScenario> = new Map();
  private activeTests: Map<string, TestResults> = new Map();
  private simulatedDevices: Map<string, SimulatedDevice> = new Map();
  private testTimers: Map<string, NodeJS.Timeout[]> = new Map();
  private dataGenerator: TestDataGenerator;

  constructor(
    redis: Redis,
    scannerService: USBScannerService,
    scanProcessor: RealtimeScanProcessor,
  ) {
    super();
    this.redis = redis;
    this.scannerService = scannerService;
    this.scanProcessor = scanProcessor;
    this.dataGenerator = new DefaultTestDataGenerator();
    this.initializeService();
  }

  // Initialize the test service
  private async initializeService() {
    try {
      logger.info('Initializing Scanner Test Service');

      // Load default test scenarios
      await this.loadDefaultScenarios();

      // Load simulated devices
      await this.loadSimulatedDevices();

      logger.info('Scanner Test Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Scanner Test Service', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Load default test scenarios
  private async loadDefaultScenarios() {
    const defaultScenarios: TestScenario[] = [
      {
        id: 'basic_scan_test',
        name: 'Basic Scan Test',
        description:
          'Test basic scanning functionality with various barcode types',
        type: 'basic_scan',
        config: {
          scanCount: 50,
          scanInterval: 200,
          dataTypes: ['student', 'book', 'equipment'],
          errorRate: 0.05,
          duplicateRate: 0.1,
        },
      },
      {
        id: 'bulk_scan_test',
        name: 'Bulk Scan Test',
        description: 'Test system performance under high scan volume',
        type: 'bulk_scan',
        config: {
          scanCount: 1000,
          scanInterval: 50,
          dataTypes: ['student', 'book', 'equipment'],
          errorRate: 0.02,
          duplicateRate: 0.05,
        },
      },
      {
        id: 'error_handling_test',
        name: 'Error Handling Test',
        description: 'Test system resilience with high error rates',
        type: 'error_handling',
        config: {
          scanCount: 100,
          scanInterval: 100,
          dataTypes: ['student', 'book', 'equipment', 'invalid'],
          errorRate: 0.3,
          duplicateRate: 0.1,
        },
      },
      {
        id: 'performance_test',
        name: 'Performance Test',
        description: 'Test system performance under optimal conditions',
        type: 'performance',
        config: {
          scanCount: 500,
          scanInterval: 25,
          dataTypes: ['student', 'book', 'equipment'],
          errorRate: 0.01,
          duplicateRate: 0.02,
        },
      },
      {
        id: 'duplicate_detection_test',
        name: 'Duplicate Detection Test',
        description: 'Test duplicate prevention functionality',
        type: 'duplicate_detection',
        config: {
          scanCount: 200,
          scanInterval: 100,
          dataTypes: ['student', 'book'],
          errorRate: 0.05,
          duplicateRate: 0.3,
        },
      },
      {
        id: 'multi_device_test',
        name: 'Multi-Device Test',
        description: 'Test concurrent scanning from multiple devices',
        type: 'device_simulation',
        config: {
          scanCount: 300,
          scanInterval: 75,
          dataTypes: ['student', 'book', 'equipment'],
          errorRate: 0.03,
          duplicateRate: 0.08,
          concurrentDevices: 3,
        },
      },
    ];

    for (const scenario of defaultScenarios) {
      this.testScenarios.set(scenario.id, scenario);
    }

    logger.info(`Loaded ${defaultScenarios.length} default test scenarios`);
  }

  // Load simulated devices
  private async loadSimulatedDevices() {
    const devices: SimulatedDevice[] = [
      {
        id: 'sim_honeywell_1200g',
        name: 'Simulated Honeywell 1200G',
        type: 'usb_scanner',
        vendorId: 0x0c2e,
        productId: 0x0a00,
        enabled: true,
        scanInterval: 100,
        errorRate: 0.02,
      },
      {
        id: 'sim_zebra_ls2208',
        name: 'Simulated Zebra LS2208',
        type: 'usb_scanner',
        vendorId: 0x0a5c,
        productId: 0x4500,
        enabled: true,
        scanInterval: 120,
        errorRate: 0.015,
      },
      {
        id: 'sim_mobile_scanner',
        name: 'Simulated Mobile Scanner',
        type: 'mobile_scanner',
        vendorId: 0x1234,
        productId: 0x5678,
        enabled: true,
        scanInterval: 150,
        errorRate: 0.025,
      },
    ];

    for (const device of devices) {
      this.simulatedDevices.set(device.id, device);
    }

    logger.info(`Loaded ${devices.length} simulated devices`);
  }

  // Get all test scenarios
  getTestScenarios(): TestScenario[] {
    return Array.from(this.testScenarios.values());
  }

  // Get a specific test scenario
  getTestScenario(scenarioId: string): TestScenario | null {
    return this.testScenarios.get(scenarioId) || null;
  }

  // Create custom test scenario
  createTestScenario(scenario: Omit<TestScenario, 'id'>): TestScenario {
    const newScenario: TestScenario = {
      ...scenario,
      id: this.generateScenarioId(),
    };

    this.testScenarios.set(newScenario.id, newScenario);
    logger.info('Created test scenario', {
      scenarioId: newScenario.id,
      name: newScenario.name,
    });

    return newScenario;
  }

  // Run a test scenario
  async runTestScenario(scenarioId: string): Promise<string> {
    try {
      const scenario = this.testScenarios.get(scenarioId);
      if (!scenario) {
        throw new Error(`Test scenario not found: ${scenarioId}`);
      }

      const testId = this.generateTestId();

      // Initialize test results
      const testResults: TestResults = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        duplicateScans: 0,
        invalidScans: 0,
        averageProcessingTime: 0,
        throughput: 0,
        errors: [],
        deviceResults: new Map(),
      };

      this.activeTests.set(testId, testResults);

      logger.info('Starting test scenario', {
        testId,
        scenarioId,
        scenarioName: scenario.name,
      });
      this.emit('testStarted', { testId, scenario });

      // Execute test based on type
      switch (scenario.type) {
        case 'basic_scan':
        case 'bulk_scan':
        case 'error_handling':
        case 'performance':
        case 'duplicate_detection':
          await this.executeStandardTest(testId, scenario);
          break;
        case 'device_simulation':
          await this.executeDeviceSimulationTest(testId, scenario);
          break;
      }

      return testId;
    } catch (error) {
      logger.error('Failed to run test scenario', {
        error: (error as Error).message,
        scenarioId,
      });
      throw error;
    }
  }

  // Execute standard test scenario
  private async executeStandardTest(testId: string, scenario: TestScenario) {
    const testResults = this.activeTests.get(testId);
    if (!testResults) return;

    const timers: NodeJS.Timeout[] = [];
    this.testTimers.set(testId, timers);

    const deviceId = `test_device_${testId}`;

    // Initialize device results
    testResults.deviceResults.set(deviceId, {
      deviceId,
      deviceName: 'Test Device',
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      averageScanTime: 0,
      lastScanTime: null,
    });

    // Generate and send scan data
    for (let i = 0; i < scenario.config.scanCount; i++) {
      const timer = setTimeout(async () => {
        try {
          await this.generateAndSendScan(testId, deviceId, scenario.config);
        } catch (error) {
          logger.error('Error in test scan', {
            error: (error as Error).message,
            testId,
          });
        }
      }, i * scenario.config.scanInterval);

      timers.push(timer);
    }

    // Schedule test completion
    const completionTimer = setTimeout(
      () => {
        this.completeTest(testId);
      },
      scenario.config.scanCount * scenario.config.scanInterval + 1000,
    );

    timers.push(completionTimer);
  }

  // Execute device simulation test
  private async executeDeviceSimulationTest(
    testId: string,
    scenario: TestScenario,
  ) {
    const testResults = this.activeTests.get(testId);
    if (!testResults) return;

    const timers: NodeJS.Timeout[] = [];
    this.testTimers.set(testId, timers);

    const deviceCount = scenario.config.concurrentDevices || 1;
    const scansPerDevice = Math.ceil(scenario.config.scanCount / deviceCount);

    // Get available simulated devices
    const availableDevices = Array.from(this.simulatedDevices.values()).slice(
      0,
      deviceCount,
    );

    if (availableDevices.length === 0) {
      logger.warn('No simulated devices available for device simulation test', {
        testId,
      });
      return;
    }

    for (
      let deviceIndex = 0;
      deviceIndex < availableDevices.length;
      deviceIndex++
    ) {
      const device = availableDevices[deviceIndex];
      if (!device) {
        continue;
      }
      const { id: deviceId, scanInterval } = device;

      // Initialize device results
      testResults.deviceResults.set(deviceId, {
        deviceId,
        deviceName: device.name,
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        averageScanTime: 0,
        lastScanTime: null,
      });

      // Generate scans for this device
      for (let scanIndex = 0; scanIndex < scansPerDevice; scanIndex++) {
        const timer = setTimeout(
          async () => {
            try {
              await this.generateAndSendScan(testId, deviceId, scenario.config);
            } catch (error) {
              logger.error('Error in device simulation scan', {
                error: (error as Error).message,
                testId,
                deviceId,
              });
            }
          },
          scanIndex * scanInterval + deviceIndex * 100,
        ); // Stagger device start times

        timers.push(timer);
      }
    }

    // Schedule test completion
    const maxInterval = Math.max(
      ...availableDevices.map(
        device => device?.scanInterval ?? scenario.config.scanInterval,
      ),
    );
    const completionDelay = maxInterval * scansPerDevice + 2000;

    const completionTimer = setTimeout(() => {
      this.completeTest(testId);
    }, completionDelay);

    timers.push(completionTimer);
  }

  // Generate and send scan data
  private async generateAndSendScan(
    testId: string,
    deviceId: string,
    config: TestScenarioConfig,
  ) {
    const testResults = this.activeTests.get(testId);
    if (!testResults) return;

    try {
      // Determine if this scan should be an error
      const shouldError = Math.random() < (config.errorRate || 0);
      const shouldDuplicate = Math.random() < (config.duplicateRate || 0);

      let scanData: string;

      if (shouldError) {
        scanData = this.dataGenerator.generateInvalidBarcode();
      } else {
        // Generate scan data based on configured types
        const dataType =
          config.dataTypes[Math.floor(Math.random() * config.dataTypes.length)];

        switch (dataType) {
          case 'student':
            scanData = this.dataGenerator.generateStudentId();
            break;
          case 'book':
            scanData = this.dataGenerator.generateBookBarcode();
            break;
          case 'equipment':
            scanData = this.dataGenerator.generateEquipmentTag();
            break;
          case 'invalid':
            scanData = this.dataGenerator.generateInvalidBarcode();
            break;
          default:
            scanData = this.dataGenerator.generateStudentId();
        }

        // Check for duplication
        if (shouldDuplicate && testResults.totalScans > 0) {
          // Use a previous scan data for duplication
          scanData = this.dataGenerator.generateStudentId(); // This would be replaced with actual previous data
        }
      }

      // Send scan data to processor
      const startTime = Date.now();
      await this.scanProcessor.processManualScan(scanData, deviceId);
      const processingTime = Date.now() - startTime;

      // Update test results
      testResults.totalScans++;
      testResults.averageProcessingTime =
        (testResults.averageProcessingTime * (testResults.totalScans - 1) +
          processingTime) /
        testResults.totalScans;

      // Update device results
      const deviceResults = testResults.deviceResults.get(deviceId);
      if (deviceResults) {
        deviceResults.totalScans++;
        deviceResults.averageScanTime =
          (deviceResults.averageScanTime * (deviceResults.totalScans - 1) +
            processingTime) /
          deviceResults.totalScans;
        deviceResults.lastScanTime = new Date();
      }

      // Emit progress event
      this.emit('testProgress', {
        testId,
        progress: (testResults.totalScans / config.scanCount) * 100,
        currentScan: testResults.totalScans,
        totalScans: config.scanCount,
        deviceId,
        scanData,
        processingTime,
      });
    } catch (error) {
      // Record error
      const testError: TestError = {
        timestamp: new Date(),
        deviceId,
        error: (error as Error).message,
        data: 'Unknown',
        context: { testId },
      };

      testResults.errors.push(testError);
      testResults.failedScans++;

      // Emit error event
      this.emit('testError', { testId, error: testError });
    }
  }

  // Complete a test
  private completeTest(testId: string) {
    const testResults = this.activeTests.get(testId);
    if (!testResults) return;

    // Calculate final metrics
    testResults.endTime = new Date();
    testResults.duration =
      testResults.endTime.getTime() - testResults.startTime.getTime();
    testResults.throughput =
      testResults.totalScans / (testResults.duration / 1000);

    // Clean up timers
    const timers = this.testTimers.get(testId);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      this.testTimers.delete(testId);
    }

    // Calculate success/failure rates
    testResults.successfulScans =
      testResults.totalScans - testResults.failedScans;

    logger.info('Test completed', {
      testId,
      scenarioName: testResults.scenarioName,
      duration: testResults.duration,
      totalScans: testResults.totalScans,
      successfulScans: testResults.successfulScans,
      throughput: testResults.throughput,
    });

    // Store test results in Redis
    this.storeTestResults(testId, testResults);

    // Emit completion event
    this.emit('testCompleted', { testId, results: testResults });

    // Remove from active tests
    this.activeTests.delete(testId);
  }

  // Store test results in Redis
  private async storeTestResults(testId: string, results: TestResults) {
    try {
      const key = `test:results:${testId}`;
      await this.redis.setex(key, 60 * 60 * 24, JSON.stringify(results)); // 24 hours TTL
    } catch (error) {
      logger.error('Failed to store test results', {
        error: (error as Error).message,
        testId,
      });
    }
  }

  // Get test results
  async getTestResults(testId: string): Promise<TestResults | null> {
    try {
      // Check active tests first
      const activeResults = this.activeTests.get(testId);
      if (activeResults) {
        return { ...activeResults };
      }

      // Check Redis for completed tests
      const key = `test:results:${testId}`;
      const resultsData = await this.redis.get(key);
      if (resultsData) {
        const results = JSON.parse(resultsData) as TestResults;
        // Convert deviceResults back to Map
        results.deviceResults = new Map(Object.entries(results.deviceResults));
        return results;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get test results', {
        error: (error as Error).message,
        testId,
      });
      return null;
    }
  }

  // Get all test results
  async getAllTestResults(): Promise<TestResults[]> {
    try {
      const results: TestResults[] = [];

      // Add active test results
      for (const testResults of this.activeTests.values()) {
        results.push({ ...testResults });
      }

      // Get completed test results from Redis
      const keys = await this.redis.keys('test:results:*');
      for (const key of keys) {
        const resultsData = await this.redis.get(key);
        if (resultsData) {
          const testResults = JSON.parse(resultsData) as TestResults;
          testResults.deviceResults = new Map(
            Object.entries(testResults.deviceResults),
          );
          results.push(testResults);
        }
      }

      // Sort by start time (most recent first)
      results.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );

      return results;
    } catch (error) {
      logger.error('Failed to get all test results', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  // Stop an active test
  async stopTest(testId: string): Promise<boolean> {
    try {
      const testResults = this.activeTests.get(testId);
      if (!testResults) {
        return false;
      }

      // Clean up timers
      const timers = this.testTimers.get(testId);
      if (timers) {
        timers.forEach(timer => clearTimeout(timer));
        this.testTimers.delete(testId);
      }

      // Complete test with current results
      this.completeTest(testId);

      logger.info('Test stopped', { testId });
      this.emit('testStopped', { testId });

      return true;
    } catch (error) {
      logger.error('Failed to stop test', {
        error: (error as Error).message,
        testId,
      });
      return false;
    }
  }

  // Delete test results
  async deleteTestResults(testId: string): Promise<boolean> {
    try {
      // Remove from active tests
      this.activeTests.delete(testId);

      // Remove from Redis
      const key = `test:results:${testId}`;
      await this.redis.del(key);

      logger.info('Test results deleted', { testId });
      return true;
    } catch (error) {
      logger.error('Failed to delete test results', {
        error: (error as Error).message,
        testId,
      });
      return false;
    }
  }

  // Get simulated devices
  getSimulatedDevices(): SimulatedDevice[] {
    return Array.from(this.simulatedDevices.values());
  }

  // Get active test identifiers
  getActiveTestIds(): string[] {
    return Array.from(this.activeTests.keys());
  }

  // Get active test summaries
  getActiveTests(): TestResults[] {
    return Array.from(this.activeTests.values());
  }

  // Update simulated device
  updateSimulatedDevice(
    deviceId: string,
    updates: Partial<SimulatedDevice>,
  ): boolean {
    const device = this.simulatedDevices.get(deviceId);
    if (!device) {
      return false;
    }

    Object.assign(device, updates);
    this.simulatedDevices.set(deviceId, device);

    logger.info('Simulated device updated', { deviceId, updates });
    return true;
  }

  // Generate test ID
  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate scenario ID
  private generateScenarioId(): string {
    return `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clean up resources
  async cleanup() {
    try {
      logger.info('Cleaning up Scanner Test Service');

      // Stop all active tests
      const activeTestIds = Array.from(this.activeTests.keys());
      for (const testId of activeTestIds) {
        await this.stopTest(testId);
      }

      // Remove all event listeners
      this.removeAllListeners();

      logger.info('Scanner Test Service cleaned up successfully');
    } catch (error) {
      logger.error('Error during cleanup', { error: (error as Error).message });
    }
  }
}

// Default test data generator implementation
class DefaultTestDataGenerator implements TestDataGenerator {
  private studentIdCounter = 1000;
  private bookBarcodeCounter = 50000;
  private equipmentTagCounter = 100;

  generateStudentId(): string {
    this.studentIdCounter++;
    return this.studentIdCounter.toString();
  }

  generateBookBarcode(): string {
    this.bookBarcodeCounter++;
    return `BK${this.bookBarcodeCounter.toString().padStart(8, '0')}`;
  }

  generateEquipmentTag(): string {
    this.equipmentTagCounter++;
    return `EQ-${this.equipmentTagCounter.toString().padStart(4, '0')}`;
  }

  generateInvalidBarcode(): string {
    // Generate various types of invalid barcodes
    const invalidTypes = [
      'INVALID123',
      'TOO_SHORT',
      'WAY_TOO_LONG_BARCODE_THAT_EXCEEDS_MAXIMUM_LENGTH_LIMITS_AND_SHOULD_BE_REJECTED',
      '',
      'SPECIAL!@#$%^&*()',
      '123456789012345678901234567890',
      'NULL',
    ];

    const index = Math.floor(Math.random() * invalidTypes.length);
    return invalidTypes[index] ?? 'INVALID_CODE';
  }

  generateQRCode(): string {
    // Generate QR code content (URLs, text, etc.)
    const qrContent = [
      `https://library.example.com/student/${this.generateStudentId()}`,
      `https://library.example.com/book/${this.generateBookBarcode()}`,
      `ISBN:978-0-123456-78-9`,
      `EQUIPMENT:${this.generateEquipmentTag()}`,
      `Check-in:${new Date().toISOString()}`,
    ];

    const index = Math.floor(Math.random() * qrContent.length);
    return qrContent[index] ?? 'https://library.example.com';
  }
}

// Singleton instance
let testServiceInstance: ScannerTestService | null = null;

export function getScannerTestService(
  redis: Redis,
  scannerService: USBScannerService,
  scanProcessor: RealtimeScanProcessor,
): ScannerTestService {
  if (!testServiceInstance) {
    testServiceInstance = new ScannerTestService(
      redis,
      scannerService,
      scanProcessor,
    );
  }
  return testServiceInstance;
}

export default ScannerTestService;
