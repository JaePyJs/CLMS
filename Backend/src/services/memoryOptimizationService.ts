import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { performanceMonitoringService } from '@/services/performanceMonitoringService';

/**
 * Memory Usage Statistics
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsedPercentage: number;
  timestamp: number;
}

/**
 * Memory Leak Detection Result
 */
export interface MemoryLeakResult {
  detected: boolean;
  growthRate: number;
  suspiciousOperations: string[];
  recommendations: string[];
}

/**
 * Memory Optimization Configuration
 */
export interface MemoryOptimizationConfig {
  enableAutoGC: boolean;
  gcThreshold: number; // MB
  enableLeakDetection: boolean;
  leakDetectionInterval: number; // minutes
  enableMemoryMonitoring: boolean;
  memoryMonitoringInterval: number; // seconds
  maxMemoryUsage: number; // MB
  enableMemoryProfiling: boolean;
}

/**
 * Memory Operation Tracker
 */
interface MemoryOperation {
  id: string;
  name: string;
  startTime: number;
  startMemory: number;
  endTime?: number;
  endMemory?: number;
  memoryDelta?: number;
}

/**
 * Memory Optimization Service
 * 
 * Provides tools for monitoring memory usage, detecting memory leaks,
 * and optimizing memory consumption in the CLMS application.
 */
export class MemoryOptimizationService extends EventEmitter {
  private config: MemoryOptimizationConfig;
  private memorySnapshots: MemoryStats[] = [];
  private operations: Map<string, MemoryOperation> = new Map();
  private intervals: NodeJS.Timeout[] = [];
  private isRunning: boolean = false;
  private lastGC: number = 0;

  constructor(config?: Partial<MemoryOptimizationConfig>) {
    super();
    
    this.config = {
      enableAutoGC: true,
      gcThreshold: 500, // 500MB
      enableLeakDetection: true,
      leakDetectionInterval: 10, // 10 minutes
      enableMemoryMonitoring: true,
      memoryMonitoringInterval: 30, // 30 seconds
      maxMemoryUsage: 1024, // 1GB
      enableMemoryProfiling: false,
      ...config
    };
  }

  /**
   * Start the memory optimization service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Memory optimization service is already running');
      return;
    }

    this.isRunning = true;

    // Start memory monitoring
    if (this.config.enableMemoryMonitoring) {
      const monitoringInterval = setInterval(() => {
        this.captureMemorySnapshot();
        this.checkMemoryThresholds();
      }, this.config.memoryMonitoringInterval * 1000);
      this.intervals.push(monitoringInterval);
    }

    // Start leak detection
    if (this.config.enableLeakDetection) {
      const leakDetectionInterval = setInterval(() => {
        this.detectMemoryLeaks();
      }, this.config.leakDetectionInterval * 60000);
      this.intervals.push(leakDetectionInterval);
    }

    logger.info('Memory optimization service started', this.config);
    this.emit('started');
  }

  /**
   * Stop the memory optimization service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Memory optimization service is not running');
      return;
    }

    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.isRunning = false;

    logger.info('Memory optimization service stopped');
    this.emit('stopped');
  }

  /**
   * Capture a memory snapshot
   */
  captureMemorySnapshot(): MemoryStats {
    const memUsage = process.memoryUsage();
    const stats: MemoryStats = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsedPercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      timestamp: Date.now()
    };

    this.memorySnapshots.push(stats);

    // Keep only the last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots = this.memorySnapshots.slice(-100);
    }

    // Record performance metric
    performanceMonitoringService.recordMetric({
      category: 'memory',
      operation: 'snapshot',
      duration: stats.heapUsedPercentage,
      success: true,
      metadata: {
        heapUsed: stats.heapUsed / 1024 / 1024, // MB
        heapTotal: stats.heapTotal / 1024 / 1024, // MB
        external: stats.external / 1024 / 1024, // MB
        rss: stats.rss / 1024 / 1024 // MB
      }
    });

    this.emit('snapshot', stats);
    return stats;
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage(): MemoryStats {
    return this.captureMemorySnapshot();
  }

  /**
   * Get memory usage history
   */
  getMemoryUsageHistory(limit?: number): MemoryStats[] {
    const snapshots = [...this.memorySnapshots].reverse();
    return limit ? snapshots.slice(0, limit) : snapshots;
  }

  /**
   * Start tracking a memory operation
   */
  startOperation(id: string, name: string): void {
    const startMemory = process.memoryUsage().heapUsed;
    
    this.operations.set(id, {
      id,
      name,
      startTime: Date.now(),
      startMemory
    });
  }

  /**
   * End tracking a memory operation
   */
  endOperation(id: string): { memoryDelta: number; duration: number } | null {
    const operation = this.operations.get(id);
    if (!operation) {
      return null;
    }

    const endMemory = process.memoryUsage().heapUsed;
    const endTime = Date.now();
    const memoryDelta = endMemory - operation.startMemory;
    const duration = endTime - operation.startTime;

    // Update operation
    operation.endTime = endTime;
    operation.endMemory = endMemory;
    operation.memoryDelta = memoryDelta;

    // Record performance metric
    performanceMonitoringService.recordMetric({
      category: 'memory',
      operation: operation.name,
      duration: memoryDelta,
      success: true,
      metadata: {
        memoryDelta: memoryDelta / 1024 / 1024, // MB
        duration,
        operationId: id
      }
    });

    // Clean up operation after 10 minutes
    setTimeout(() => {
      this.operations.delete(id);
    }, 600000);

    this.emit('operationEnded', {
      id,
      name: operation.name,
      memoryDelta: memoryDelta / 1024 / 1024, // MB
      duration
    });

    return { memoryDelta: memoryDelta / 1024 / 1024, duration };
  }

  /**
   * Track a function's memory usage
   */
  async trackMemory<T>(
    id: string,
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; memoryDelta: number; duration: number }> {
    this.startOperation(id, name);
    
    try {
      const result = await fn();
      const operation = this.endOperation(id);
      
      return {
        result,
        memoryDelta: operation?.memoryDelta || 0,
        duration: operation?.duration || 0
      };
    } catch (error) {
      this.operations.delete(id);
      throw error;
    }
  }

  /**
   * Force garbage collection
   */
  forceGC(): boolean {
    if (global.gc) {
      const beforeGC = this.captureMemorySnapshot();
      global.gc();
      const afterGC = this.captureMemorySnapshot();
      
      const memoryFreed = (beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024; // MB
      this.lastGC = Date.now();
      
      logger.info(`Garbage collection completed`, {
        memoryFreed: `${memoryFreed.toFixed(2)} MB`,
        beforeGC: `${(beforeGC.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        afterGC: `${(afterGC.heapUsed / 1024 / 1024).toFixed(2)} MB`
      });
      
      this.emit('gc', { memoryFreed, beforeGC, afterGC });
      return true;
    } else {
      logger.warn('Garbage collection not available');
      return false;
    }
  }

  /**
   * Check memory thresholds and trigger actions
   */
  private checkMemoryThresholds(): void {
    const currentMemory = this.getCurrentMemoryUsage();
    const memoryUsageMB = currentMemory.heapUsed / 1024 / 1024;

    // Check if we're above the maximum memory usage
    if (memoryUsageMB > this.config.maxMemoryUsage) {
      logger.warn(`Memory usage above threshold: ${memoryUsageMB.toFixed(2)} MB`);
      
      this.emit('highMemoryUsage', {
        current: memoryUsageMB,
        threshold: this.config.maxMemoryUsage
      });

      // Force garbage collection if enabled
      if (this.config.enableAutoGC && memoryUsageMB > this.config.gcThreshold) {
        this.forceGC();
      }
    }

    // Check for memory growth rate
    if (this.memorySnapshots.length > 10) {
      const recentSnapshots = this.memorySnapshots.slice(-10);
      const oldestSnapshot = recentSnapshots[0];
      const newestSnapshot = recentSnapshots[recentSnapshots.length - 1];
      
      const timeDiff = (newestSnapshot.timestamp - oldestSnapshot.timestamp) / 1000 / 60; // minutes
      const memoryDiff = (newestSnapshot.heapUsed - oldestSnapshot.heapUsed) / 1024 / 1024; // MB
      const growthRate = memoryDiff / timeDiff; // MB per minute

      if (growthRate > 10) { // Growing more than 10MB per minute
        logger.warn(`High memory growth rate detected: ${growthRate.toFixed(2)} MB/min`);
        
        this.emit('highMemoryGrowthRate', {
          growthRate,
          timeDiff,
          memoryDiff
        });

        // Force garbage collection if enabled
        if (this.config.enableAutoGC) {
          this.forceGC();
        }
      }
    }
  }

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks(): MemoryLeakResult {
    if (this.memorySnapshots.length < 5) {
      return {
        detected: false,
        growthRate: 0,
        suspiciousOperations: [],
        recommendations: ['Need more memory snapshots to detect leaks']
      };
    }

    // Analyze memory growth trend
    const recentSnapshots = this.memorySnapshots.slice(-10);
    const oldestSnapshot = recentSnapshots[0];
    const newestSnapshot = recentSnapshots[recentSnapshots.length - 1];
    
    const timeDiff = (newestSnapshot.timestamp - oldestSnapshot.timestamp) / 1000 / 60; // minutes
    const memoryDiff = (newestSnapshot.heapUsed - oldestSnapshot.heapUsed) / 1024 / 1024; // MB
    const growthRate = memoryDiff / timeDiff; // MB per minute

    // Check for suspicious operations
    const suspiciousOperations: string[] = [];
    const operations = Array.from(this.operations.values())
      .filter(op => op.memoryDelta !== undefined && op.memoryDelta > 0)
      .sort((a, b) => (b.memoryDelta || 0) - (a.memoryDelta || 0))
      .slice(0, 5);

    operations.forEach(op => {
      if (op.memoryDelta && op.memoryDelta > 10 * 1024 * 1024) { // More than 10MB
        suspiciousOperations.push(op.name);
      }
    });

    // Generate recommendations
    const recommendations: string[] = [];
    let detected = false;

    if (growthRate > 5) { // Growing more than 5MB per minute
      detected = true;
      recommendations.push('Memory leak detected: High growth rate');
      recommendations.push('Review recent code changes for memory leaks');
      recommendations.push('Consider using memory profiling tools');
    }

    if (suspiciousOperations.length > 0) {
      detected = true;
      recommendations.push(`Suspicious operations detected: ${suspiciousOperations.join(', ')}`);
      recommendations.push('Review these operations for memory leaks');
    }

    if (newestSnapshot.heapUsedPercentage > 90) {
      detected = true;
      recommendations.push('High memory usage detected');
      recommendations.push('Consider increasing memory limits or optimizing memory usage');
    }

    const result: MemoryLeakResult = {
      detected,
      growthRate,
      suspiciousOperations,
      recommendations
    };

    if (detected) {
      this.emit('memoryLeakDetected', result);
      logger.warn('Memory leak detected', result);
    }

    return result;
  }

  /**
   * Optimize memory usage
   */
  optimizeMemory(): {
    beforeOptimization: MemoryStats;
    afterOptimization: MemoryStats;
    memoryFreed: number;
    actions: string[];
  } {
    const beforeOptimization = this.getCurrentMemoryUsage();
    const actions: string[] = [];

    // Force garbage collection
    if (this.forceGC()) {
      actions.push('Forced garbage collection');
    }

    // Clear old memory snapshots
    const originalSnapshotCount = this.memorySnapshots.length;
    this.memorySnapshots = this.memorySnapshots.slice(-50);
    if (this.memorySnapshots.length < originalSnapshotCount) {
      actions.push(`Cleared ${originalSnapshotCount - this.memorySnapshots.length} old memory snapshots`);
    }

    // Clear old operations
    const operationCount = this.operations.size;
    const now = Date.now();
    for (const [id, operation] of this.operations.entries()) {
      // Remove operations older than 30 minutes
      if (now - operation.startTime > 1800000) {
        this.operations.delete(id);
      }
    }
    if (this.operations.size < operationCount) {
      actions.push(`Cleared ${operationCount - this.operations.size} old operation trackers`);
    }

    const afterOptimization = this.getCurrentMemoryUsage();
    const memoryFreed = (beforeOptimization.heapUsed - afterOptimization.heapUsed) / 1024 / 1024; // MB

    logger.info('Memory optimization completed', {
      memoryFreed: `${memoryFreed.toFixed(2)} MB`,
      actions: actions.length
    });

    this.emit('optimized', {
      beforeOptimization,
      afterOptimization,
      memoryFreed,
      actions
    });

    return {
      beforeOptimization,
      afterOptimization,
      memoryFreed,
      actions
    };
  }

  /**
   * Get memory optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const currentMemory = this.getCurrentMemoryUsage();
    const memoryUsageMB = currentMemory.heapUsed / 1024 / 1024;

    // General recommendations
    if (memoryUsageMB > 500) {
      recommendations.push('High memory usage detected. Consider optimizing data structures.');
    }

    if (currentMemory.heapUsedPercentage > 80) {
      recommendations.push('High heap usage percentage. Look for memory leaks.');
    }

    if (currentMemory.external > 100 * 1024 * 1024) { // More than 100MB
      recommendations.push('High external memory usage. Check for native module leaks.');
    }

    // Operation-specific recommendations
    const operations = Array.from(this.operations.values())
      .filter(op => op.memoryDelta !== undefined && op.memoryDelta > 0)
      .sort((a, b) => (b.memoryDelta || 0) - (a.memoryDelta || 0));

    if (operations.length > 0) {
      const topOperation = operations[0];
      if (topOperation.memoryDelta && topOperation.memoryDelta > 50 * 1024 * 1024) { // More than 50MB
        recommendations.push(`Operation "${topOperation.name}" uses a lot of memory. Consider optimizing it.`);
      }
    }

    // Configuration-specific recommendations
    if (!this.config.enableAutoGC) {
      recommendations.push('Consider enabling automatic garbage collection.');
    }

    if (!this.config.enableLeakDetection) {
      recommendations.push('Consider enabling memory leak detection.');
    }

    return recommendations;
  }

  /**
   * Generate a memory usage report
   */
  generateReport(): {
    current: MemoryStats;
    history: MemoryStats[];
    operations: Array<{
      id: string;
      name: string;
      duration: number;
      memoryDelta: number;
    }>;
    leakDetection: MemoryLeakResult;
    recommendations: string[];
    config: MemoryOptimizationConfig;
  } {
    const current = this.getCurrentMemoryUsage();
    const history = this.getMemoryUsageHistory(20);
    const leakDetection = this.detectMemoryLeaks();
    const recommendations = this.getRecommendations();

    // Process operations
    const operations = Array.from(this.operations.values())
      .filter(op => op.endTime && op.endMemory && op.memoryDelta !== undefined)
      .map(op => ({
        id: op.id,
        name: op.name,
        duration: op.endTime! - op.startTime,
        memoryDelta: op.memoryDelta! / 1024 / 1024 // MB
      }))
      .sort((a, b) => b.memoryDelta - a.memoryDelta)
      .slice(0, 10);

    return {
      current,
      history,
      operations,
      leakDetection,
      recommendations,
      config: this.config
    };
  }
}

// Singleton instance
export let memoryOptimizationService: MemoryOptimizationService;

export function initializeMemoryOptimizationService(config?: Partial<MemoryOptimizationConfig>): void {
  memoryOptimizationService = new MemoryOptimizationService(config);
  memoryOptimizationService.start();
}