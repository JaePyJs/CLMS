/**
 * Optimized Job Processing System
 *
 * This service provides enhanced background job processing with
 * load balancing, priority queues, and advanced monitoring.
 */

import Bull, { Job, JobOptions, Queue, QueueOptions } from 'bull';
import { enhancedRedis } from '@/config/redis';
import { logger } from '@/utils/logger';

interface JobConfig {
  // Queue settings
  defaultJobOptions: JobOptions;
  settings: {
    stalledInterval: number;
    maxStalledCount: number;
    guardInterval: number;
    retryProcessDelay: number;
  };

  // Concurrency settings
  concurrency: {
    default: number;
    high: number;
    medium: number;
    low: number;
  };

  // Performance settings
  drainDelay: number;
  maxMemory: number;
    batchSize: number;
  batchTimeout: number;
}

interface JobMetrics {
  total: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
  paused: number;
  stalled: number;

  // Performance metrics
  averageProcessingTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;

  // Queue-specific metrics
  byQueue: Map<string, {
    total: number;
    completed: number;
    failed: number;
    averageTime: number;
  }>;
}

interface JobDefinition {
  name: string;
  handler: (job: Job) => Promise<any>;
  options: {
    concurrency?: number;
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: string;
    removeOnComplete?: number;
    removeOnFail?: number;
  };
}

class OptimizedJobProcessor {
  private config: JobConfig;
  private queues: Map<string, Queue> = new Map();
  private jobDefinitions: Map<string, JobDefinition> = new Map();
  private metrics: JobMetrics;
  private processingBatches: Map<string, Set<string>> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.metrics = this.initializeMetrics();
    this.setupGlobalQueueSettings();
    this.setupMonitoring();
  }

  private loadConfig(): JobConfig {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      defaultJobOptions: {
        removeOnComplete: parseInt(process.env.JOB_REMOVE_ON_COMPLETE || '100'),
        removeOnFail: parseInt(process.env.JOB_REMOVE_ON_FAIL || '50'),
        attempts: parseInt(process.env.JOB_DEFAULT_ATTEMPTS || '3'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.JOB_BACKOFF_DELAY || '2000'),
        },
      },

      settings: {
        stalledInterval: parseInt(process.env.JOB_STALLED_INTERVAL || '30000'),
        maxStalledCount: parseInt(process.env.JOB_MAX_STALLED_COUNT || '1'),
        guardInterval: parseInt(process.env.JOB_GUARD_INTERVAL || '5000'),
        retryProcessDelay: parseInt(process.env.JOB_RETRY_PROCESS_DELAY || '5000'),
      },

      concurrency: {
        default: parseInt(process.env.JOB_DEFAULT_CONCURRENCY || '5'),
        high: parseInt(process.env.JOB_HIGH_CONCURRENCY || '10'),
        medium: parseInt(process.env.JOB_MEDIUM_CONCURRENCY || '5'),
        low: parseInt(process.env.JOB_LOW_CONCURRENCY || '2'),
      },

      drainDelay: parseInt(process.env.JOB_DRAIN_DELAY || '5000'),
      maxMemory: parseInt(process.env.JOB_MAX_MEMORY || '512'), // MB
      batchSize: parseInt(process.env.JOB_BATCH_SIZE || '10'),
      batchTimeout: parseInt(process.env.JOB_BATCH_TIMEOUT || '1000'),
    };
  }

  private initializeMetrics(): JobMetrics {
    return {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      waiting: 0,
      paused: 0,
      stalled: 0,
      averageProcessingTime: 0,
      throughput: 0,
      errorRate: 0,
      memoryUsage: 0,
      byQueue: new Map(),
    };
  }

  private setupGlobalQueueSettings(): void {
    // Default Redis connection for Bull queues
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '1'), // Use separate DB for jobs
    };

    Bull.prototype.create = function(options?: QueueOptions): Queue {
      return new Bull(this.name, {
        redis: redisConfig,
        defaultJobOptions: this.config.defaultJobOptions,
        settings: this.config.settings,
        ...options,
      });
    };
  }

  private setupMonitoring(): void {
    // Monitor memory usage
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Every 30 seconds

    // Update metrics
    setInterval(() => {
      this.updateMetrics();
    }, 10000); // Every 10 seconds

    // Log metrics
    setInterval(() => {
      this.logMetrics();
    }, 60000); // Every minute
  }

  // Queue management
  createQueue(name: string, options: QueueOptions = {}): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Bull(name, {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '1'),
      },
      defaultJobOptions: this.config.defaultJobOptions,
      settings: this.config.settings,
      ...options,
    });

    this.setupQueueEventListeners(queue, name);
    this.queues.set(name, queue);

    logger.info('Queue created', { name, options });

    return queue;
  }

  private setupQueueEventListeners(queue: Queue, name: string): void {
    queue.on('completed', (job, result) => {
      this.metrics.completed++;
      this.updateJobMetrics(name, job, 'completed');

      logger.debug('Job completed', {
        queue: name,
        jobId: job.id,
        duration: Date.now() - job.timestamp,
      });
    });

    queue.on('failed', (job, error) => {
      this.metrics.failed++;
      this.updateJobMetrics(name, job, 'failed');

      logger.error('Job failed', {
        queue: name,
        jobId: job.id,
        error: error.message,
        attemptsMade: job.attemptsMade,
      });
    });

    queue.on('stalled', (job) => {
      this.metrics.stalled++;

      logger.warn('Job stalled', {
        queue: name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      });
    });

    queue.on('progress', (job, progress) => {
      logger.debug('Job progress', {
        queue: name,
        jobId: job.id,
        progress,
      });
    });

    queue.on('error', (error) => {
      logger.error('Queue error', {
        queue: name,
        error: error.message,
      });
    });
  }

  // Job registration and processing
  registerJob(jobDefinition: JobDefinition): void {
    const { name, handler, options } = jobDefinition;

    let queue = this.queues.get('default');
    if (!queue) {
      queue = this.createQueue('default');
    }

    const concurrency = options.concurrency || this.config.concurrency.default;

    queue.process(name, concurrency, async (job) => {
      const startTime = Date.now();

      try {
        const result = await handler(job);

        const duration = Date.now() - startTime;
        this.updateProcessingTime(duration);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('Job processing error', {
          jobName: name,
          jobId: job.id,
          duration,
          error: (error as Error).message,
        });

        throw error;
      }
    });

    this.jobDefinitions.set(name, jobDefinition);

    logger.info('Job registered', {
      name,
      concurrency,
      options,
    });
  }

  // Job creation and management
  async addJob<T>(
    name: string,
    data: any,
    options: JobOptions = {}
  ): Promise<Job<T>> {
    const queue = this.getQueueForJob(name);
    const jobDefinition = this.jobDefinitions.get(name);

    if (!jobDefinition) {
      throw new Error(`Job definition not found: ${name}`);
    }

    // Merge default options with job-specific options
    const mergedOptions = {
      ...jobDefinition.options,
      ...options,
      priority: options.priority || jobDefinition.options.priority || 0,
    };

    this.metrics.total++;

    const job = await queue.add(name, data, mergedOptions);

    logger.debug('Job added', {
      name,
      jobId: job.id,
      options: mergedOptions,
    });

    return job;
  }

  async addBulkJobs<T>(
    jobs: Array<{
      name: string;
      data: any;
      options?: JobOptions;
    }>
  ): Promise<Job<T>[]> {
    const jobGroups = new Map<string, Array<{ data: any; options: JobOptions }>>();

    // Group jobs by queue
    jobs.forEach(({ name, data, options = {} }) => {
      const queueName = this.getQueueNameForJob(name);

      if (!jobGroups.has(queueName)) {
        jobGroups.set(queueName, []);
      }

      jobGroups.get(queueName)!.push({ data, options });
    });

    const results: Job<T>[] = [];

    // Add jobs in batches per queue
    for (const [queueName, jobList] of jobGroups) {
      const queue = this.queues.get(queueName);
      if (!queue) continue;

      const batchJobs = jobList.map(({ data, options }) => ({
        name: queueName,
        data,
        options,
      }));

      const addedJobs = await queue.addBulk(batchJobs);
      results.push(...addedJobs);

      this.metrics.total += jobList.length;
    }

    logger.info('Bulk jobs added', {
      totalJobs: jobs.length,
      batches: jobGroups.size,
    });

    return results;
  }

  // Batch processing
  async processBatch<T>(
    name: string,
    items: any[],
    processor: (batch: any[]) => Promise<T[]>,
    options: {
      batchSize?: number;
      concurrency?: number;
      delay?: number;
    } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || this.config.batchSize;
    const concurrency = options.concurrency || 1;
    const delay = options.delay || 0;

    const batches: any[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results: T[] = [];
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.processingBatches.set(name, new Set([batchId]));

    try {
      const processBatchWithDelay = async (batch: any[], index: number): Promise<T[]> => {
        if (delay > 0 && index > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return await processor(batch);
      };

      // Process batches with controlled concurrency
      for (let i = 0; i < batches.length; i += concurrency) {
        const concurrentBatches = batches.slice(i, i + concurrency);
        const batchPromises = concurrentBatches.map((batch, index) =>
          processBatchWithDelay(batch, i + index)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.flat());
      }

      logger.info('Batch processing completed', {
        name,
        batchId,
        totalItems: items.length,
        batchSize,
        batchesProcessed: batches.length,
        resultCount: results.length,
      });

      return results;
    } finally {
      this.processingBatches.get(name)?.delete(batchId);
    }
  }

  // Priority queue management
  async addHighPriorityJob<T>(name: string, data: any, options: JobOptions = {}): Promise<Job<T>> {
    return this.addJob(name, data, {
      ...options,
      priority: 10, // High priority
    });
  }

  async addLowPriorityJob<T>(name: string, data: any, options: JobOptions = {}): Promise<Job<T>> {
    return this.addJob(name, data, {
      ...options,
      priority: 1, // Low priority
    });
  }

  // Queue operations
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  getQueueForJob(jobName: string): Queue {
    const queueName = this.getQueueNameForJob(jobName);
    let queue = this.queues.get(queueName);

    if (!queue) {
      queue = this.createQueue(queueName);
    }

    return queue;
  }

  private getQueueNameForJob(jobName: string): string {
    // Map job names to queues based on type or priority
    if (jobName.startsWith('high-')) return 'high-priority';
    if (jobName.startsWith('low-')) return 'low-priority';
    if (jobName.startsWith('batch-')) return 'batch-processing';
    return 'default';
  }

  // Queue management operations
  async pauseQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.pause();
      logger.info('Queue paused', { name });
    }
  }

  async resumeQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.resume();
      logger.info('Queue resumed', { name });
    }
  }

  async pauseAllQueues(): Promise<void> {
    const promises = Array.from(this.queues.values()).map(queue => queue.pause());
    await Promise.all(promises);
    logger.info('All queues paused');
  }

  async resumeAllQueues(): Promise<void> {
    const promises = Array.from(this.queues.values()).map(queue => queue.resume());
    await Promise.all(promises);
    logger.info('All queues resumed');
  }

  async clearQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');
      logger.info('Queue cleared', { name });
    }
  }

  async clearAllQueues(): Promise<void> {
    const promises = Array.from(this.queues.keys()).map(name => this.clearQueue(name));
    await Promise.all(promises);
    logger.info('All queues cleared');
  }

  // Monitoring and metrics
  async getQueueStats(name: string): Promise<any> {
    const queue = this.queues.get(name);
    if (!queue) return null;

    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();
    const paused = await queue.getPaused();

    return {
      name,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused.length,
    };
  }

  async getAllQueueStats(): Promise<any[]> {
    const stats = [];
    for (const name of this.queues.keys()) {
      const stat = await this.getQueueStats(name);
      if (stat) stats.push(stat);
    }
    return stats;
  }

  private updateMetrics(): void {
    // This would be enhanced with real-time metrics collection
    // For now, we'll calculate basic metrics
    const total = this.metrics.completed + this.metrics.failed;
    this.metrics.errorRate = total > 0 ? (this.metrics.failed / total) * 100 : 0;

    // Calculate throughput (jobs per second)
    const timeWindow = 60; // 1 minute
    this.metrics.throughput = total / timeWindow;
  }

  private updateJobMetrics(queueName: string, job: Job, status: string): void {
    let queueMetrics = this.metrics.byQueue.get(queueName);
    if (!queueMetrics) {
      queueMetrics = {
        total: 0,
        completed: 0,
        failed: 0,
        averageTime: 0,
      };
      this.metrics.byQueue.set(queueName, queueMetrics);
    }

    queueMetrics.total++;

    if (status === 'completed') {
      queueMetrics.completed++;
      const duration = Date.now() - job.timestamp;
      queueMetrics.averageTime = (queueMetrics.averageTime + duration) / 2;
    } else if (status === 'failed') {
      queueMetrics.failed++;
    }
  }

  private updateProcessingTime(duration: number): void {
    const totalJobs = this.metrics.completed + this.metrics.failed;
    if (totalJobs === 1) {
      this.metrics.averageProcessingTime = duration;
    } else {
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime * (totalJobs - 1) + duration) / totalJobs;
    }
  }

  private checkMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    this.metrics.memoryUsage = heapUsedMB;

    if (heapUsedMB > this.config.maxMemory) {
      logger.warn('High memory usage detected', {
        heapUsed: `${heapUsedMB.toFixed(2)}MB`,
        maxMemory: `${this.config.maxMemory}MB`,
      });

      // Trigger memory cleanup
      this.triggerMemoryCleanup();
    }
  }

  private async triggerMemoryCleanup(): Promise<void> {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clean up old completed jobs
      await this.cleanupOldJobs();

      logger.info('Memory cleanup completed');
    } catch (error) {
      logger.error('Memory cleanup failed', {
        error: (error as Error).message,
      });
    }
  }

  private async cleanupOldJobs(): Promise<void> {
    const retentionDays = parseInt(process.env.JOB_RETENTION_DAYS || '7');
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    for (const [name, queue] of this.queues) {
      try {
        await queue.clean(cutoffTime, 'completed');
        await queue.clean(cutoffTime, 'failed');
      } catch (error) {
        logger.error('Failed to cleanup old jobs in queue', {
          queue: name,
          error: (error as Error).message,
        });
      }
    }
  }

  private logMetrics(): void {
    logger.info('Job processor metrics', {
      ...this.metrics,
      queueCount: this.queues.size,
      registeredJobs: this.jobDefinitions.size,
      activeBatches: Array.from(this.processingBatches.values())
        .reduce((total, batches) => total + batches.size, 0),
    });
  }

  // Public API
  getMetrics(): JobMetrics {
    return { ...this.metrics };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    queues: any[];
    metrics: JobMetrics;
    memory: any;
  }> {
    try {
      const queueStats = await this.getAllQueueStats();
      const memoryUsage = process.memoryUsage();

      const healthy = memoryUsage.heapUsed / 1024 / 1024 < this.config.maxMemory;

      return {
        healthy,
        queues: queueStats,
        metrics: this.getMetrics(),
        memory: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        queues: [],
        metrics: this.getMetrics(),
        memory: { error: (error as Error).message },
      };
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down job processor...');

    // Pause all queues first
    await this.pauseAllQueues();

    // Wait for active jobs to complete
    await new Promise(resolve => setTimeout(resolve, this.config.drainDelay));

    // Close all queues
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);

    logger.info('Job processor shutdown completed');
  }
}

// Create and export singleton instance
export const optimizedJobProcessor = new OptimizedJobProcessor();
export default optimizedJobProcessor;