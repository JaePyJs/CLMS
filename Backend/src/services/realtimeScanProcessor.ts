import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { Redis } from 'ioredis';
import { USBScannerService, ScanData } from './usbScannerService';
import { scanBarcode, scanStudentBarcode, ScanResult } from './scanService';
import { WebSocketServer } from '@/websocket/websocketServer';

// Scan event types
export type ScanEventType = 'scan_start' | 'scan_success' | 'scan_error' | 'scan_duplicate' | 'scan_invalid';

// Real-time scan event
export interface RealtimeScanEvent {
  id: string;
  type: ScanEventType;
  deviceId: string;
  deviceName: string;
  scanData: string;
  timestamp: Date;
  processingTime: number;
  result?: ScanResult;
  error?: string;
  metadata?: Record<string, any>;
}

// Scan processor configuration
export interface ScanProcessorConfig {
  enableRealtimeValidation: boolean;
  enableWebSocketBroadcast: boolean;
  enableAudioFeedback: boolean;
  enableVisualFeedback: boolean;
  enableDuplicatePrevention: boolean;
  duplicateWindowMs: number;
  batchSize: number;
  batchTimeoutMs: number;
}

// Scan statistics
export interface ScanStatistics {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  duplicateScans: number;
  invalidScans: number;
  averageProcessingTime: number;
  lastScanTime: Date | null;
  scansByDevice: Map<string, number>;
  scansByType: Map<string, number>;
}

export class RealtimeScanProcessor extends EventEmitter {
  private redis: Redis;
  private scannerService: USBScannerService;
  private websocketServer: WebSocketServer;
  private config: ScanProcessorConfig;
  private processingQueue: ScanData[] = [];
  private processingTimer: NodeJS.Timeout | null = null;
  private statistics: ScanStatistics;
  private activeProcessing: Map<string, boolean> = new Map();

  constructor(
    redis: Redis,
    scannerService: USBScannerService,
    websocketServer: WebSocketServer,
    config: Partial<ScanProcessorConfig> = {}
  ) {
    super();

    this.redis = redis;
    this.scannerService = scannerService;
    this.websocketServer = websocketServer;

    // Default configuration
    this.config = {
      enableRealtimeValidation: true,
      enableWebSocketBroadcast: true,
      enableAudioFeedback: true,
      enableVisualFeedback: true,
      enableDuplicatePrevention: true,
      duplicateWindowMs: 30 * 60 * 1000, // 30 minutes
      batchSize: 10,
      batchTimeoutMs: 100,
      ...config,
    };

    // Initialize statistics
    this.statistics = {
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      duplicateScans: 0,
      invalidScans: 0,
      averageProcessingTime: 0,
      lastScanTime: null,
      scansByDevice: new Map(),
      scansByType: new Map(),
    };

    this.initializeProcessor();
  }

  // Initialize the processor
  private async initializeProcessor() {
    try {
      logger.info('Initializing Real-time Scan Processor');

      // Set up scanner service event listeners
      this.scannerService.on('scan', this.handleScannerScan.bind(this));
      this.scannerService.on('scannerConnected', this.handleScannerConnected.bind(this));
      this.scannerService.on('scannerDisconnected', this.handleScannerDisconnected.bind(this));
      this.scannerService.on('scannerError', this.handleScannerError.bind(this));

      // Start batch processing timer
      this.startBatchProcessing();

      logger.info('Real-time Scan Processor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Real-time Scan Processor', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Handle incoming scan from scanner service
  private async handleScannerScan(scanData: ScanData) {
    try {
      const startTime = Date.now();

      // Add to processing queue
      this.processingQueue.push(scanData);

      // Update statistics
      this.statistics.totalScans++;
      this.statistics.lastScanTime = new Date();
      const deviceCount = this.statistics.scansByDevice.get(scanData.deviceId) || 0;
      this.statistics.scansByDevice.set(scanData.deviceId, deviceCount + 1);

      // Emit scan start event
      await this.emitScanEvent({
        id: this.generateEventId(),
        type: 'scan_start',
        deviceId: scanData.deviceId,
        deviceName: scanData.deviceInfo.product,
        scanData: scanData.data,
        timestamp: new Date(),
        processingTime: 0,
      });

      // Process immediately if batch size reached or if batch processing is disabled
      if (this.config.batchSize <= 1 || this.processingQueue.length >= this.config.batchSize) {
        this.processBatch();
      }

      logger.debug('Scan received and queued', {
        deviceId: scanData.deviceId,
        data: scanData.data,
        queueSize: this.processingQueue.length,
      });

    } catch (error) {
      logger.error('Error handling scanner scan', {
        error: (error as Error).message,
        scanData,
      });
    }
  }

  // Process a batch of scans
  private async processBatch() {
    if (this.processingQueue.length === 0) {
      return;
    }

    const batch = this.processingQueue.splice(0, this.config.batchSize);

    for (const scanData of batch) {
      await this.processSingleScan(scanData);
    }
  }

  // Process a single scan
  private async processSingleScan(scanData: ScanData): Promise<void> {
    const startTime = Date.now();
    const deviceId = scanData.deviceId;

    try {
      // Check if already processing for this device
      if (this.activeProcessing.get(deviceId)) {
        // Re-queue for later processing
        this.processingQueue.push(scanData);
        return;
      }

      this.activeProcessing.set(deviceId, true);

      // Create scan event
      const eventId = this.generateEventId();

      // Check for duplicates if enabled
      if (this.config.enableDuplicatePrevention) {
        const isDuplicate = await this.checkDuplicateInRedis(scanData.data);
        if (isDuplicate) {
          await this.handleDuplicateScan(scanData, eventId, startTime);
          return;
        }
      }

      // Process the scan
      const result = await this.processScanData(scanData);

      if (result) {
        await this.handleSuccessfulScan(scanData, result, eventId, startTime);
      } else {
        await this.handleInvalidScan(scanData, eventId, startTime);
      }

    } catch (error) {
      await this.handleScanError(scanData, error as Error, eventId, startTime);
    } finally {
      this.activeProcessing.set(deviceId, false);
    }
  }

  // Process scan data using existing scan service
  private async processScanData(scanData: ScanData): Promise<ScanResult | null> {
    try {
      let result: ScanResult;

      // If data is numeric, try student scan first
      if (/^\d+$/.test(scanData.data)) {
        result = await scanStudentBarcode(scanData.data);
      } else {
        result = await scanBarcode(scanData.data);
      }

      // Update type statistics
      const typeCount = this.statistics.scansByType.get(result.type) || 0;
      this.statistics.scansByType.set(result.type, typeCount + 1);

      return result;
    } catch (error) {
      logger.error('Error processing scan data', {
        error: (error as Error).message,
        scanData,
      });
      return null;
    }
  }

  // Handle successful scan
  private async handleSuccessfulScan(
    scanData: ScanData,
    result: ScanResult,
    eventId: string,
    startTime: number
  ) {
    const processingTime = Date.now() - startTime;

    // Update statistics
    this.statistics.successfulScans++;
    this.updateAverageProcessingTime(processingTime);

    // Store in Redis for duplicate prevention
    if (this.config.enableDuplicatePrevention) {
      await this.storeScanInRedis(scanData.data);
    }

    // Create success event
    const event: RealtimeScanEvent = {
      id: eventId,
      type: 'scan_success',
      deviceId: scanData.deviceId,
      deviceName: scanData.deviceInfo.product,
      scanData: scanData.data,
      timestamp: new Date(),
      processingTime,
      result,
      metadata: {
        deviceInfo: scanData.deviceInfo,
        rawData: scanData.rawData.toString('hex'),
      },
    };

    await this.emitScanEvent(event);

    // Provide feedback
    if (this.config.enableAudioFeedback) {
      this.playSuccessSound();
    }

    if (this.config.enableVisualFeedback) {
      this.emit('visualFeedback', { type: 'success', data: scanData.data });
    }

    logger.info('Scan processed successfully', {
      deviceId: scanData.deviceId,
      data: scanData.data,
      type: result.type,
      processingTime,
    });

    this.emit('scanProcessed', { scanData, result, processingTime });
  }

  // Handle duplicate scan
  private async handleDuplicateScan(
    scanData: ScanData,
    eventId: string,
    startTime: number
  ) {
    const processingTime = Date.now() - startTime;

    // Update statistics
    this.statistics.duplicateScans++;

    // Create duplicate event
    const event: RealtimeScanEvent = {
      id: eventId,
      type: 'scan_duplicate',
      deviceId: scanData.deviceId,
      deviceName: scanData.deviceInfo.product,
      scanData: scanData.data,
      timestamp: new Date(),
      processingTime,
      metadata: {
        deviceInfo: scanData.deviceInfo,
      },
    };

    await this.emitScanEvent(event);

    // Provide feedback
    if (this.config.enableAudioFeedback) {
      this.playWarningSound();
    }

    if (this.config.enableVisualFeedback) {
      this.emit('visualFeedback', { type: 'duplicate', data: scanData.data });
    }

    logger.debug('Duplicate scan detected', {
      deviceId: scanData.deviceId,
      data: scanData.data,
    });

    this.emit('scanDuplicate', { scanData });
  }

  // Handle invalid scan
  private async handleInvalidScan(
    scanData: ScanData,
    eventId: string,
    startTime: number
  ) {
    const processingTime = Date.now() - startTime;

    // Update statistics
    this.statistics.invalidScans++;

    // Create invalid event
    const event: RealtimeScanEvent = {
      id: eventId,
      type: 'scan_invalid',
      deviceId: scanData.deviceId,
      deviceName: scanData.deviceInfo.product,
      scanData: scanData.data,
      timestamp: new Date(),
      processingTime,
      error: 'No matching entity found',
      metadata: {
        deviceInfo: scanData.deviceInfo,
      },
    };

    await this.emitScanEvent(event);

    // Provide feedback
    if (this.config.enableAudioFeedback) {
      this.playErrorSound();
    }

    if (this.config.enableVisualFeedback) {
      this.emit('visualFeedback', { type: 'error', data: scanData.data });
    }

    logger.debug('Invalid scan detected', {
      deviceId: scanData.deviceId,
      data: scanData.data,
    });

    this.emit('scanInvalid', { scanData });
  }

  // Handle scan error
  private async handleScanError(
    scanData: ScanData,
    error: Error,
    eventId: string,
    startTime: number
  ) {
    const processingTime = Date.now() - startTime;

    // Update statistics
    this.statistics.failedScans++;

    // Create error event
    const event: RealtimeScanEvent = {
      id: eventId,
      type: 'scan_error',
      deviceId: scanData.deviceId,
      deviceName: scanData.deviceInfo.product,
      scanData: scanData.data,
      timestamp: new Date(),
      processingTime,
      error: error.message,
      metadata: {
        deviceInfo: scanData.deviceInfo,
        stack: error.stack,
      },
    };

    await this.emitScanEvent(event);

    // Provide feedback
    if (this.config.enableAudioFeedback) {
      this.playErrorSound();
    }

    if (this.config.enableVisualFeedback) {
      this.emit('visualFeedback', { type: 'error', data: scanData.data });
    }

    logger.error('Scan processing error', {
      deviceId: scanData.deviceId,
      data: scanData.data,
      error: error.message,
    });

    this.emit('scanError', { scanData, error });
  }

  // Emit scan event via WebSocket
  private async emitScanEvent(event: RealtimeScanEvent) {
    try {
      if (this.config.enableWebSocketBroadcast) {
        // Broadcast to all connected clients
        this.websocketServer.broadcast('scan_event', event);
      }

      // Emit locally
      this.emit('scanEvent', event);

    } catch (error) {
      logger.error('Error emitting scan event', {
        error: (error as Error).message,
        eventId: event.id,
      });
    }
  }

  // Check for duplicate scan in Redis
  private async checkDuplicateInRedis(data: string): Promise<boolean> {
    try {
      const key = `scan:dup:${this.hashScanData(data)}`;
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking duplicate in Redis', { error: (error as Error).message });
      return false;
    }
  }

  // Store scan data in Redis for duplicate prevention
  private async storeScanInRedis(data: string) {
    try {
      const key = `scan:dup:${this.hashScanData(data)}`;
      await this.redis.setex(key, Math.ceil(this.config.duplicateWindowMs / 1000), '1');
    } catch (error) {
      logger.error('Error storing scan in Redis', { error: (error as Error).message });
    }
  }

  // Hash scan data for Redis key
  private hashScanData(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }

  // Update average processing time
  private updateAverageProcessingTime(processingTime: number) {
    const total = this.statistics.totalScans;
    const current = this.statistics.averageProcessingTime;
    this.statistics.averageProcessingTime = ((current * (total - 1)) + processingTime) / total;
  }

  // Generate unique event ID
  private generateEventId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start batch processing timer
  private startBatchProcessing() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    this.processingTimer = setInterval(() => {
      if (this.processingQueue.length > 0) {
        this.processBatch();
      }
    }, this.config.batchTimeoutMs);
  }

  // Handle scanner connection events
  private handleScannerConnected(data: { deviceId: string; status: any }) {
    logger.info('Scanner connected', { deviceId: data.deviceId });
    this.emit('scannerConnected', data);

    if (this.config.enableWebSocketBroadcast) {
      this.websocketServer.broadcast('scanner_connected', data);
    }
  }

  // Handle scanner disconnection events
  private handleScannerDisconnected(data: { deviceId: string }) {
    logger.info('Scanner disconnected', { deviceId: data.deviceId });
    this.emit('scannerDisconnected', data);

    if (this.config.enableWebSocketBroadcast) {
      this.websocketServer.broadcast('scanner_disconnected', data);
    }
  }

  // Handle scanner error events
  private handleScannerError(data: { deviceId: string; error: string }) {
    logger.error('Scanner error', { deviceId: data.deviceId, error: data.error });
    this.emit('scannerError', data);

    if (this.config.enableWebSocketBroadcast) {
      this.websocketServer.broadcast('scanner_error', data);
    }
  }

  // Audio feedback methods (placeholder implementations)
  private playSuccessSound() {
    try {
      // System beep for success
      process.stdout.write('\x07');
    } catch (error) {
      logger.debug('Failed to play success sound', { error: (error as Error).message });
    }
  }

  private playWarningSound() {
    try {
      // Different beep pattern for warning
      process.stdout.write('\x07\x07');
    } catch (error) {
      logger.debug('Failed to play warning sound', { error: (error as Error).message });
    }
  }

  private playErrorSound() {
    try {
      // Longer beep pattern for error
      process.stdout.write('\x07\x07\x07');
    } catch (error) {
      logger.debug('Failed to play error sound', { error: (error as Error).message });
    }
  }

  // Get current statistics
  getStatistics(): ScanStatistics {
    return { ...this.statistics };
  }

  // Reset statistics
  resetStatistics() {
    this.statistics = {
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      duplicateScans: 0,
      invalidScans: 0,
      averageProcessingTime: 0,
      lastScanTime: null,
      scansByDevice: new Map(),
      scansByType: new Map(),
    };

    logger.info('Scan statistics reset');
    this.emit('statisticsReset');
  }

  // Update configuration
  updateConfig(updates: Partial<ScanProcessorConfig>) {
    this.config = { ...this.config, ...updates };

    // Restart batch processing if timeout changed
    if (updates.batchTimeoutMs !== undefined) {
      this.startBatchProcessing();
    }

    logger.info('Scan processor configuration updated', { updates });
    this.emit('configUpdated', this.config);
  }

  // Get current configuration
  getConfig(): ScanProcessorConfig {
    return { ...this.config };
  }

  // Process manual scan (for testing or manual input)
  async processManualScan(data: string, deviceId: string = 'manual'): Promise<ScanResult> {
    try {
      const scanData: ScanData = {
        deviceId,
        data,
        timestamp: new Date(),
        rawData: Buffer.from(data),
        deviceInfo: {
          path: 'manual',
          vendorId: 0,
          productId: 0,
          product: 'Manual Input',
          manufacturer: 'System',
          interface: 0,
          usagePage: 0,
          usage: 0,
        },
      };

      const result = await this.processScanData(scanData);

      if (result) {
        await this.handleSuccessfulScan(scanData, result, this.generateEventId(), Date.now());
      } else {
        await this.handleInvalidScan(scanData, this.generateEventId(), Date.now());
      }

      return result || {
        type: 'unknown',
        data: null,
        message: 'Invalid scan data',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      await this.handleScanError(
        {
          deviceId,
          data,
          timestamp: new Date(),
          rawData: Buffer.from(data),
          deviceInfo: {
            path: 'manual',
            vendorId: 0,
            productId: 0,
            product: 'Manual Input',
            manufacturer: 'System',
            interface: 0,
            usagePage: 0,
            usage: 0,
          },
        },
        error as Error,
        this.generateEventId(),
        Date.now()
      );

      throw error;
    }
  }

  // Clean up resources
  async cleanup() {
    try {
      logger.info('Cleaning up Real-time Scan Processor');

      // Stop batch processing
      if (this.processingTimer) {
        clearInterval(this.processingTimer);
        this.processingTimer = null;
      }

      // Clear processing queue
      this.processingQueue = [];
      this.activeProcessing.clear();

      // Remove all event listeners
      this.removeAllListeners();

      logger.info('Real-time Scan Processor cleaned up successfully');
    } catch (error) {
      logger.error('Error during cleanup', { error: (error as Error).message });
    }
  }
}

export default RealtimeScanProcessor;