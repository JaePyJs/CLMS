import HID from 'node-hid';
import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { Redis } from 'ioredis';

// Scanner device information interface
export interface ScannerDevice {
  path: string;
  vendorId: number;
  productId: number;
  product: string;
  manufacturer: string;
  serialNumber?: string;
  interface: number;
  usagePage: number;
  usage: number;
}

// Scanner configuration interface
export interface ScannerConfig {
  vendorId?: number;
  productId?: number;
  devicePath?: string;
  enabled: boolean;
  name: string;
  bufferSize: number;
  timeout: number;
  prefix?: string;
  suffix?: string;
  minLength: number;
  maxLength: number;
  beepOnScan: boolean;
  visualFeedback: boolean;
  duplicatePrevention: boolean;
  duplicateWindow: number; // in milliseconds
}

// Scan data interface
export interface ScanData {
  deviceId: string;
  data: string;
  timestamp: Date;
  rawData: Buffer;
  deviceInfo: ScannerDevice;
}

// Scanner status interface
export interface ScannerStatus {
  deviceId: string;
  name: string;
  connected: boolean;
  lastScan: Date | null;
  scanCount: number;
  errorCount: number;
  lastError: string | null;
  deviceInfo: ScannerDevice | null;
}

// Known scanner vendor/product IDs
const KNOWN_SCANNERS = {
  HONEYWELL: [
    { vendorId: 0x0c2e, productId: 0x0a00 }, // Honeywell 1200g
    { vendorId: 0x0c2e, productId: 0x0b03 }, // Honeywell 1450g
    { vendorId: 0x0c2e, productId: 0x0a24 }, // Honeywell 1900g
  ],
  ZEBRA: [
    { vendorId: 0x0a5c, productId: 0x4500 }, // Zebra LI2208
    { vendorId: 0x0a5c, productId: 0x4508 }, // Zebra LS2208
    { vendorId: 0x05e0, productId: 0x1200 }, // Zebra DS2208
  ],
  DATALOGIC: [
    { vendorId: 0x05e0, productId: 0x1900 }, // Datalogic QuickScan
    { vendorId: 0x05e0, productId: 0x1300 }, // Datalogic Gryphon
  ],
  SYMBOL: [
    { vendorId: 0x05e0, productId: 0x0700 }, // Symbol LS2208
    { vendorId: 0x05e0, productId: 0x0800 }, // Symbol LS1203
  ],
  GENERIC: [
    { usagePage: 0x01, usage: 0x06 }, // Generic keyboard
    { usagePage: 0x0c, usage: 0x01 }, // Consumer control
  ]
};

export class USBScannerService extends EventEmitter {
  private devices: Map<string, HID.HID> = new Map();
  private deviceConfigs: Map<string, ScannerConfig> = new Map();
  private deviceStatuses: Map<string, ScannerStatus> = new Map();
  private scanBuffers: Map<string, string[]> = new Map();
  private scanTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private redis: Redis;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.initializeService();
  }

  // Initialize the scanner service
  private async initializeService() {
    try {
      logger.info('Initializing USB Scanner Service');

      // Discover existing scanners
      await this.discoverScanners();

      // Start device monitoring
      this.startDeviceMonitoring();

      logger.info('USB Scanner Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize USB Scanner Service', { error: (error as Error).message });
      throw error;
    }
  }

  // Discover all connected scanner devices
  async discoverScanners(): Promise<ScannerDevice[]> {
    try {
      const devices = HID.devices();
      const scanners: ScannerDevice[] = [];

      logger.info(`Scanning ${devices.length} HID devices for scanners`);

      for (const device of devices) {
        if (this.isScannerDevice(device)) {
          const scannerDevice: ScannerDevice = {
            path: device.path,
            vendorId: device.vendorId,
            productId: device.productId,
            product: device.product || 'Unknown Scanner',
            manufacturer: device.manufacturer || 'Unknown Manufacturer',
            serialNumber: device.serialNumber,
            interface: device.interface || -1,
            usagePage: device.usagePage || 0,
            usage: device.usage || 0,
          };

          scanners.push(scannerDevice);
          logger.info('Found scanner device', {
            path: device.path,
            product: device.product,
            vendorId: `0x${device.vendorId?.toString(16)}`,
            productId: `0x${device.productId?.toString(16)}`,
          });
        }
      }

      return scanners;
    } catch (error) {
      logger.error('Error discovering scanners', { error: (error as Error).message });
      return [];
    }
  }

  // Check if a device is a scanner based on known characteristics
  private isScannerDevice(device: any): boolean {
    // Check known scanner vendor/product IDs
    for (const [brand, models] of Object.entries(KNOWN_SCANNERS)) {
      for (const model of models) {
        if (model.vendorId && model.productId) {
          if (device.vendorId === model.vendorId && device.productId === model.productId) {
            return true;
          }
        }

        // Check usage page and usage for generic scanners
        if (model.usagePage && model.usage) {
          if (device.usagePage === model.usagePage && device.usage === model.usage) {
            // Additional check for barcode scanners (often have specific interface numbers)
            return device.interface === 0 || device.interface === 1;
          }
        }
      }
    }

    // Check device name patterns
    const productName = (device.product || '').toLowerCase();
    const manufacturerName = (device.manufacturer || '').toLowerCase();

    const scannerKeywords = [
      'scanner', 'barcode', 'reader', 'scan', 'bar code',
      'symbol', 'zebra', 'honeywell', 'datalogic', 'metrologic',
      'intermec', 'unitech', 'argox', 'cognitive'
    ];

    return scannerKeywords.some(keyword =>
      productName.includes(keyword) || manufacturerName.includes(keyword)
    );
  }

  // Connect to a specific scanner device
  async connectScanner(config: ScannerConfig): Promise<boolean> {
    try {
      const deviceId = this.generateDeviceId(config);

      // Check if already connected
      if (this.devices.has(deviceId)) {
        logger.warn('Scanner already connected', { deviceId });
        return true;
      }

      let device: HID.HID;

      // Try to connect by device path first
      if (config.devicePath) {
        device = new HID.HID(config.devicePath);
      } else if (config.vendorId && config.productId) {
        // Try to find device by vendor/product ID
        const devices = await this.discoverScanners();
        const targetDevice = devices.find(d =>
          d.vendorId === config.vendorId && d.productId === config.productId
        );

        if (!targetDevice) {
          throw new Error(`Scanner not found: VID ${config.vendorId}, PID ${config.productId}`);
        }

        device = new HID.HID(targetDevice.path);
      } else {
        throw new Error('Either devicePath or vendorId/productId must be specified');
      }

      // Store device and config
      this.devices.set(deviceId, device);
      this.deviceConfigs.set(deviceId, config);
      this.scanBuffers.set(deviceId, []);

      // Initialize device status
      const deviceInfo = await this.getDeviceInfo(device);
      const status: ScannerStatus = {
        deviceId,
        name: config.name,
        connected: true,
        lastScan: null,
        scanCount: 0,
        errorCount: 0,
        lastError: null,
        deviceInfo,
      };
      this.deviceStatuses.set(deviceId, status);

      // Set up data event handler
      device.on('data', (data) => this.handleScanData(deviceId, data));

      // Set up error event handler
      device.on('error', (error) => this.handleDeviceError(deviceId, error));

      logger.info('Scanner connected successfully', {
        deviceId,
        name: config.name,
        product: deviceInfo.product,
      });

      this.emit('scannerConnected', { deviceId, status });
      return true;

    } catch (error) {
      logger.error('Failed to connect scanner', {
        error: (error as Error).message,
        config,
      });
      return false;
    }
  }

  // Disconnect a scanner device
  disconnectScanner(deviceId: string): boolean {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        logger.warn('Scanner not found for disconnection', { deviceId });
        return false;
      }

      // Clear scan timeout
      const timeout = this.scanTimeouts.get(deviceId);
      if (timeout) {
        clearTimeout(timeout);
        this.scanTimeouts.delete(deviceId);
      }

      // Remove event listeners and close device
      device.removeAllListeners();
      device.close();

      // Clean up device data
      this.devices.delete(deviceId);
      this.deviceConfigs.delete(deviceId);
      this.deviceStatuses.delete(deviceId);
      this.scanBuffers.delete(deviceId);

      logger.info('Scanner disconnected', { deviceId });
      this.emit('scannerDisconnected', { deviceId });
      return true;

    } catch (error) {
      logger.error('Failed to disconnect scanner', {
        error: (error as Error).message,
        deviceId,
      });
      return false;
    }
  }

  // Handle incoming scan data from a device
  private async handleScanData(deviceId: string, rawData: Buffer) {
    try {
      const config = this.deviceConfigs.get(deviceId);
      const status = this.deviceStatuses.get(deviceId);

      if (!config || !status || !config.enabled) {
        return;
      }

      // Convert buffer to string (handling different encodings)
      let scanData = this.bufferToString(rawData);

      // Add to buffer
      const buffer = this.scanBuffers.get(deviceId) || [];
      buffer.push(scanData);
      this.scanBuffers.set(deviceId, buffer);

      // Clear existing timeout
      const existingTimeout = this.scanTimeouts.get(deviceId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set timeout to process complete scan
      const timeout = setTimeout(() => {
        this.processCompleteScan(deviceId);
      }, config.timeout);

      this.scanTimeouts.set(deviceId, timeout);

    } catch (error) {
      logger.error('Error handling scan data', {
        error: (error as Error).message,
        deviceId,
      });
      this.incrementErrorCount(deviceId, (error as Error).message);
    }
  }

  // Process a complete scan from the buffer
  private async processCompleteScan(deviceId: string) {
    try {
      const config = this.deviceConfigs.get(deviceId);
      const status = this.deviceStatuses.get(deviceId);
      const buffer = this.scanBuffers.get(deviceId) || [];

      if (!config || !status || buffer.length === 0) {
        return;
      }

      // Combine buffer data
      let rawScanData = buffer.join('');

      // Clear buffer
      this.scanBuffers.set(deviceId, []);

      // Process and clean scan data
      let processedData = this.processScanData(rawScanData, config);

      if (!processedData) {
        return; // Invalid scan data
      }

      // Check for duplicate prevention
      if (config.duplicatePrevention) {
        const isDuplicate = await this.checkDuplicateScan(deviceId, processedData, config.duplicateWindow);
        if (isDuplicate) {
          logger.debug('Duplicate scan prevented', { deviceId, data: processedData });
          this.emit('duplicateScan', { deviceId, data: processedData });
          return;
        }
      }

      // Create scan data object
      const scanData: ScanData = {
        deviceId,
        data: processedData,
        timestamp: new Date(),
        rawData: Buffer.from(rawScanData),
        deviceInfo: status.deviceInfo!,
      };

      // Update status
      status.lastScan = new Date();
      status.scanCount++;
      this.deviceStatuses.set(deviceId, status);

      // Store in Redis for duplicate prevention
      await this.storeScanInRedis(deviceId, processedData, config.duplicateWindow);

      logger.info('Scan processed successfully', {
        deviceId,
        data: processedData,
        scanCount: status.scanCount,
      });

      // Emit events
      this.emit('scan', scanData);
      this.emit('scannerActivity', { deviceId, type: 'scan', data: processedData });

      // Provide feedback if enabled
      if (config.beepOnScan || config.visualFeedback) {
        this.provideFeedback(config);
      }

    } catch (error) {
      logger.error('Error processing complete scan', {
        error: (error as Error).message,
        deviceId,
      });
      this.incrementErrorCount(deviceId, (error as Error).message);
    }
  }

  // Process and clean raw scan data
  private processScanData(rawData: string, config: ScannerConfig): string | null {
    try {
      // Remove control characters
      let processed = rawData.replace(/[\x00-\x1F\x7F]/g, '');

      // Remove prefix if specified
      if (config.prefix && processed.startsWith(config.prefix)) {
        processed = processed.substring(config.prefix.length);
      }

      // Remove suffix if specified
      if (config.suffix && processed.endsWith(config.suffix)) {
        processed = processed.substring(0, processed.length - config.suffix.length);
      }

      // Trim whitespace
      processed = processed.trim();

      // Validate length
      if (processed.length < config.minLength || processed.length > config.maxLength) {
        logger.debug('Invalid scan length', {
          length: processed.length,
          min: config.minLength,
          max: config.maxLength,
          data: processed,
        });
        return null;
      }

      // Validate characters (allow common barcode characters)
      if (!/^[A-Za-z0-9\-_\.]+$/.test(processed)) {
        logger.debug('Invalid scan characters', { data: processed });
        return null;
      }

      return processed;
    } catch (error) {
      logger.error('Error processing scan data', { error: (error as Error).message });
      return null;
    }
  }

  // Convert buffer to string with proper encoding handling
  private bufferToString(buffer: Buffer): string {
    try {
      // Try different encodings
      const encodings = ['utf8', 'ascii', 'latin1'];

      for (const encoding of encodings) {
        try {
          const result = buffer.toString(encoding as BufferEncoding);
          if (result && result.length > 0 && result.trim() !== '') {
            return result;
          }
        } catch {
          // Continue to next encoding
        }
      }

      // Fallback: filter valid characters
      return buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '');
    } catch (error) {
      logger.error('Error converting buffer to string', { error: (error as Error).message });
      return '';
    }
  }

  // Check for duplicate scan in Redis
  private async checkDuplicateScan(deviceId: string, data: string, windowMs: number): Promise<boolean> {
    try {
      const key = `scanner:${deviceId}:scans:${this.hashScanData(data)}`;
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking duplicate scan', { error: (error as Error).message });
      return false; // Allow scan if check fails
    }
  }

  // Store scan data in Redis for duplicate prevention
  private async storeScanInRedis(deviceId: string, data: string, windowMs: number) {
    try {
      const key = `scanner:${deviceId}:scans:${this.hashScanData(data)}`;
      await this.redis.setex(key, Math.ceil(windowMs / 1000), '1');
    } catch (error) {
      logger.error('Error storing scan in Redis', { error: (error as Error).message });
    }
  }

  // Hash scan data for Redis key
  private hashScanData(data: string): string {
    // Simple hash function - could use crypto for better distribution
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  // Provide feedback (beep/visual) after successful scan
  private provideFeedback(config: ScannerConfig) {
    try {
      if (config.beepOnScan) {
        // System beep implementation
        process.stdout.write('\x07'); // ASCII bell character
      }

      if (config.visualFeedback) {
        // Emit visual feedback event
        this.emit('visualFeedback', { type: 'success' });
      }
    } catch (error) {
      logger.error('Error providing feedback', { error: (error as Error).message });
    }
  }

  // Handle device errors
  private handleDeviceError(deviceId: string, error: Error) {
    logger.error('Scanner device error', {
      deviceId,
      error: error.message,
    });

    this.incrementErrorCount(deviceId, error.message);
    this.emit('scannerError', { deviceId, error: error.message });

    // Try to reconnect
    setTimeout(() => {
      this.attemptReconnection(deviceId);
    }, 5000);
  }

  // Attempt to reconnect a disconnected device
  private async attemptReconnection(deviceId: string) {
    try {
      const config = this.deviceConfigs.get(deviceId);
      if (!config) {
        return;
      }

      logger.info('Attempting scanner reconnection', { deviceId });

      const success = await this.connectScanner(config);
      if (success) {
        logger.info('Scanner reconnected successfully', { deviceId });
        this.emit('scannerReconnected', { deviceId });
      } else {
        logger.warn('Scanner reconnection failed', { deviceId });
        // Schedule another attempt
        setTimeout(() => {
          this.attemptReconnection(deviceId);
        }, 10000);
      }
    } catch (error) {
      logger.error('Error during scanner reconnection', {
        error: (error as Error).message,
        deviceId,
      });
    }
  }

  // Increment error count for a device
  private incrementErrorCount(deviceId: string, errorMessage: string) {
    const status = this.deviceStatuses.get(deviceId);
    if (status) {
      status.errorCount++;
      status.lastError = errorMessage;
      this.deviceStatuses.set(deviceId, status);
    }
  }

  // Get device information from HID device
  private async getDeviceInfo(device: HID.HID): Promise<ScannerDevice> {
    try {
      const devices = HID.devices();
      const deviceInfo = devices.find(d => d.path === device.path);

      if (!deviceInfo) {
        throw new Error('Device information not found');
      }

      return {
        path: deviceInfo.path,
        vendorId: deviceInfo.vendorId,
        productId: deviceInfo.productId,
        product: deviceInfo.product || 'Unknown Scanner',
        manufacturer: deviceInfo.manufacturer || 'Unknown Manufacturer',
        serialNumber: deviceInfo.serialNumber,
        interface: deviceInfo.interface || -1,
        usagePage: deviceInfo.usagePage || 0,
        usage: deviceInfo.usage || 0,
      };
    } catch (error) {
      logger.error('Error getting device info', { error: (error as Error).message });
      throw error;
    }
  }

  // Generate unique device ID from config
  private generateDeviceId(config: ScannerConfig): string {
    if (config.devicePath) {
      return config.devicePath.replace(/[^a-zA-Z0-9]/g, '_');
    }
    if (config.vendorId && config.productId) {
      return `${config.vendorId.toString(16)}_${config.productId.toString(16)}`;
    }
    return config.name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // Start monitoring for device changes
  private startDeviceMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.checkForDeviceChanges();
    }, 5000); // Check every 5 seconds
  }

  // Check for device changes (additions/removals)
  private async checkForDeviceChanges() {
    try {
      const currentDevices = await this.discoverScanners();
      const connectedDevicePaths = Array.from(this.devices.keys()).map(deviceId => {
        const config = this.deviceConfigs.get(deviceId);
        return config?.devicePath;
      }).filter(Boolean);

      // Check for new devices
      for (const device of currentDevices) {
        if (!connectedDevicePaths.includes(device.path)) {
          logger.info('New scanner detected', { device });
          this.emit('newScannerDetected', device);
        }
      }

      // Check for removed devices
      for (const deviceId of this.devices.keys()) {
        const config = this.deviceConfigs.get(deviceId);
        if (config?.devicePath) {
          const stillConnected = currentDevices.some(d => d.path === config.devicePath);
          if (!stillConnected) {
            logger.warn('Scanner disconnected', { deviceId });
            this.handleDeviceDisconnection(deviceId);
          }
        }
      }
    } catch (error) {
      logger.error('Error checking device changes', { error: (error as Error).message });
    }
  }

  // Handle unexpected device disconnection
  private handleDeviceDisconnection(deviceId: string) {
    this.emit('scannerDisconnected', { deviceId, unexpected: true });

    // Clean up device resources
    this.devices.delete(deviceId);
    this.deviceStatuses.delete(deviceId);
    this.scanBuffers.delete(deviceId);

    const timeout = this.scanTimeouts.get(deviceId);
    if (timeout) {
      clearTimeout(timeout);
      this.scanTimeouts.delete(deviceId);
    }
  }

  // Get all connected scanner statuses
  getScannerStatuses(): ScannerStatus[] {
    return Array.from(this.deviceStatuses.values());
  }

  // Get status for a specific scanner
  getScannerStatus(deviceId: string): ScannerStatus | null {
    return this.deviceStatuses.get(deviceId) || null;
  }

  // Enable/disable a scanner
  setScannerEnabled(deviceId: string, enabled: boolean): boolean {
    const config = this.deviceConfigs.get(deviceId);
    if (!config) {
      return false;
    }

    config.enabled = enabled;
    this.deviceConfigs.set(deviceId, config);

    logger.info('Scanner enabled status changed', { deviceId, enabled });
    this.emit('scannerConfigChanged', { deviceId, enabled });

    return true;
  }

  // Configure scanner settings
  updateScannerConfig(deviceId: string, updates: Partial<ScannerConfig>): boolean {
    const config = this.deviceConfigs.get(deviceId);
    if (!config) {
      return false;
    }

    Object.assign(config, updates);
    this.deviceConfigs.set(deviceId, config);

    logger.info('Scanner configuration updated', { deviceId, updates });
    this.emit('scannerConfigChanged', { deviceId, config });

    return true;
  }

  // Clean up resources
  async cleanup() {
    try {
      logger.info('Cleaning up USB Scanner Service');

      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      this.isMonitoring = false;

      // Disconnect all devices
      const deviceIds = Array.from(this.devices.keys());
      for (const deviceId of deviceIds) {
        this.disconnectScanner(deviceId);
      }

      // Remove all event listeners
      this.removeAllListeners();

      logger.info('USB Scanner Service cleaned up successfully');
    } catch (error) {
      logger.error('Error during cleanup', { error: (error as Error).message });
    }
  }
}

// Singleton instance
let scannerServiceInstance: USBScannerService | null = null;

export function getScannerService(redis: Redis): USBScannerService {
  if (!scannerServiceInstance) {
    scannerServiceInstance = new USBScannerService(redis);
  }
  return scannerServiceInstance;
}

export default USBScannerService;