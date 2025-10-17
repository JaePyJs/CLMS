import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { z, ZodSchema } from 'zod';
import { logger } from '../utils/logger';
import { RedisConfigurationFactory } from '../config/redis.config';
import Redis from 'ioredis';
import { 
  BaseWebSocketEvent, 
  EventMetadata, 
  EventError,
  WebSocketEvent 
} from '../websocket/eventTypes';

// ============================================================================
// EVENT BUS INTERFACES AND TYPES
// ============================================================================

/**
 * Event handler function type
 */
export type EventHandler<TPayload = any> = (
  event: BaseWebSocketEvent<TPayload>
) => void | Promise<void>;

/**
 * Async event handler function type
 */
export type AsyncEventHandler<TPayload = any> = (
  event: BaseWebSocketEvent<TPayload>
) => Promise<void>;

/**
 * Event filter function type
 */
export type EventFilter<TPayload = any> = (
  event: BaseWebSocketEvent<TPayload>
) => boolean;

/**
 * Event middleware function type
 */
export type EventMiddleware<TPayload = any> = (
  event: BaseWebSocketEvent<TPayload>,
  next: () => void | Promise<void>
) => void | Promise<void>;

/**
 * Event validation schema type
 */
export type EventValidationSchema<TPayload = any> = ZodSchema<TPayload>;

/**
 * Event bus configuration interface
 */
export interface EventBusConfig {
  // Persistence settings
  enablePersistence?: boolean;
  persistenceKey?: string;
  maxHistorySize?: number;
  
  // Redis settings
  redisInstanceName?: string;
  
  // Performance settings
  enableMetrics?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  
  // Error handling
  enableErrorIsolation?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  
  // Event filtering
  enableFiltering?: boolean;
  
  // Middleware
  enableMiddleware?: boolean;
}

/**
 * Event metrics interface
 */
export interface EventMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  totalHandlers: number;
  successfulHandlers: number;
  failedHandlers: number;
  averageProcessingTime: number;
  lastEventTime?: Date;
}

/**
 * Event subscription options
 */
export interface SubscriptionOptions {
  once?: boolean;
  filter?: EventFilter;
  priority?: number;
  timeout?: number;
  retryCount?: number;
}

/**
 * Event batch interface
 */
export interface EventBatch<TPayload = any> {
  id: string;
  events: BaseWebSocketEvent<TPayload>[];
  timestamp: Date;
  size: number;
}

// ============================================================================
// EVENT TYPE REGISTRY
// ============================================================================

/**
 * Event type registry for type lookup and validation
 */
export class EventTypeRegistry {
  private static schemas: Map<string, ZodSchema> = new Map();
  private static typeDefinitions: Map<string, { payloadType: any; category: string }> = new Map();

  /**
   * Register an event type with its schema
   */
  static registerEventType<TPayload>(
    eventType: string,
    schema: ZodSchema<TPayload>,
    payloadType: any,
    category: string = 'general'
  ): void {
    this.schemas.set(eventType, schema);
    this.typeDefinitions.set(eventType, { payloadType, category });
  }

  /**
   * Get schema for an event type
   */
  static getSchema(eventType: string): ZodSchema | undefined {
    return this.schemas.get(eventType);
  }

  /**
   * Get type definition for an event type
   */
  static getTypeDefinition(eventType: string) {
    return this.typeDefinitions.get(eventType);
  }

  /**
   * Validate an event against its schema
   */
  static validateEvent<TPayload>(event: BaseWebSocketEvent<TPayload>): {
    valid: boolean;
    error?: string;
  } {
    const schema = this.getSchema(event.type);
    if (!schema) {
      return { valid: true }; // No schema means no validation required
    }

    const result = schema.safeParse(event.payload);
    if (!result.success) {
      return {
        valid: false,
        error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }

    return { valid: true };
  }

  /**
   * Get all event types
   */
  static getAllEventTypes(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get event types by category
   */
  static getEventTypesByCategory(category: string): string[] {
    return Array.from(this.typeDefinitions.entries())
      .filter(([_, def]) => def.category === category)
      .map(([type, _]) => type);
  }
}

// ============================================================================
// MIDDLEWARE SYSTEM
// ============================================================================

/**
 * Middleware manager for event processing pipeline
 */
export class EventMiddlewareManager {
  private middlewares: EventMiddleware[] = [];

  /**
   * Add middleware to the pipeline
   */
  use<TPayload = any>(middleware: EventMiddleware<TPayload>): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute middleware pipeline
   */
  async execute<TPayload = any>(
    event: BaseWebSocketEvent<TPayload>,
    finalHandler: () => void | Promise<void>
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middlewares.length) {
        await finalHandler();
        return;
      }

      const middleware = this.middlewares[index++];
      await middleware(event, next);
    };

    await next();
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares = [];
  }

  /**
   * Get middleware count
   */
  count(): number {
    return this.middlewares.length;
  }
}

// ============================================================================
// BUILT-IN MIDDLEWARE
// ============================================================================

/**
 * Logging middleware
 */
export const loggingMiddleware = <TPayload = any>(
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'
): EventMiddleware<TPayload> => {
  return async (event, next) => {
    logger[logLevel](`Processing event: ${event.type}`, {
      eventId: event.id,
      userId: event.userId,
      timestamp: event.timestamp
    });
    
    const startTime = Date.now();
    await next();
    const duration = Date.now() - startTime;
    
    logger[logLevel](`Event processed: ${event.type}`, {
      eventId: event.id,
      duration: `${duration}ms`
    });
  };
};

/**
 * Validation middleware
 */
export const validationMiddleware = <TPayload = any>(): EventMiddleware<TPayload> => {
  return async (event, next) => {
    const validation = EventTypeRegistry.validateEvent(event);
    if (!validation.valid) {
      throw new Error(`Event validation failed for ${event.type}: ${validation.error}`);
    }
    await next();
  };
};

/**
 * Error handling middleware
 */
export const errorHandlingMiddleware = <TPayload = any>(
  errorHandler?: (error: Error, event: BaseWebSocketEvent<TPayload>) => void
): EventMiddleware<TPayload> => {
  return async (event, next) => {
    try {
      await next();
    } catch (error) {
      logger.error(`Error processing event ${event.type}`, {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (errorHandler) {
        errorHandler(error instanceof Error ? error : new Error(String(error)), event);
      }
    }
  };
};

/**
 * Metrics middleware
 */
export const metricsMiddleware = <TPayload = any>(
  metricsCollector: (event: BaseWebSocketEvent<TPayload>, duration: number) => void
): EventMiddleware<TPayload> => {
  return async (event, next) => {
    const startTime = Date.now();
    await next();
    const duration = Date.now() - startTime;
    metricsCollector(event, duration);
  };
};

// ============================================================================
// MAIN EVENT BUS IMPLEMENTATION
// ============================================================================

/**
 * Type-safe event bus implementation
 */
export class EventBus<TEventMap extends Record<string, any> = Record<string, any>> {
  private emitter: EventEmitter;
  private handlers: Map<string, Set<{ handler: EventHandler; options: SubscriptionOptions }>>;
  private middlewareManager: EventMiddlewareManager;
  private config: EventBusConfig;
  private metrics: EventMetrics;
  private redisClient: Redis | null = null;
  private eventHistory: BaseWebSocketEvent[] = [];
  private batchBuffer: BaseWebSocketEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: EventBusConfig = {}) {
    this.emitter = new EventEmitter();
    this.handlers = new Map();
    this.middlewareManager = new EventMiddlewareManager();
    this.config = {
      enablePersistence: false,
      maxHistorySize: 1000,
      enableMetrics: true,
      batchSize: 10,
      batchTimeout: 100,
      enableErrorIsolation: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableFiltering: true,
      enableMiddleware: true,
      ...config
    };
    
    this.metrics = {
      totalEvents: 0,
      eventsByType: {},
      totalHandlers: 0,
      successfulHandlers: 0,
      failedHandlers: 0,
      averageProcessingTime: 0
    };

    this.initializeMiddleware();
    this.initializeRedis();
    this.setupBatchProcessing();
  }

  /**
   * Initialize default middleware
   */
  private initializeMiddleware(): void {
    if (this.config.enableMiddleware) {
      this.middlewareManager.use(errorHandlingMiddleware());
      this.middlewareManager.use(loggingMiddleware());
      
      if (this.config.enableMetrics) {
        this.middlewareManager.use(metricsMiddleware((event, duration) => {
          this.updateMetrics(event, duration);
        }));
      }
      
      this.middlewareManager.use(validationMiddleware());
    }
  }

  /**
   * Initialize Redis connection for persistence
   */
  private async initializeRedis(): Promise<void> {
    if (this.config.enablePersistence && this.config.redisInstanceName) {
      try {
        this.redisClient = await RedisConfigurationFactory.getRedisClient(
          this.config.redisInstanceName
        );
        logger.info('EventBus: Redis connection established for persistence');
      } catch (error) {
        logger.error('EventBus: Failed to connect to Redis', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.redisClient = null;
      }
    }
  }

  /**
   * Setup batch processing for high-frequency events
   */
  private setupBatchProcessing(): void {
    if (this.config.batchSize && this.config.batchSize > 1) {
      this.batchTimer = setInterval(() => {
        if (this.batchBuffer.length > 0) {
          this.processBatch();
        }
      }, this.config.batchTimeout);
    }
  }

  /**
   * Update event metrics
   */
  private updateMetrics(event: BaseWebSocketEvent, duration: number): void {
    this.metrics.totalEvents++;
    this.metrics.eventsByType[event.type] = (this.metrics.eventsByType[event.type] || 0) + 1;
    this.metrics.lastEventTime = new Date();
    
    // Update average processing time
    const totalProcessingTime = this.metrics.averageProcessingTime * (this.metrics.totalEvents - 1) + duration;
    this.metrics.averageProcessingTime = totalProcessingTime / this.metrics.totalEvents;
  }

  /**
   * Process event batch
   */
  private async processBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batch: EventBatch = {
      id: uuidv4(),
      events: [...this.batchBuffer],
      timestamp: new Date(),
      size: this.batchBuffer.length
    };

    this.batchBuffer = [];

    try {
      await this.emitter.emit('batch', batch);
    } catch (error) {
      logger.error('Error processing event batch', {
        batchId: batch.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Add event to history
   */
  private async addToHistory(event: BaseWebSocketEvent): Promise<void> {
    this.eventHistory.push(event);
    
    // Maintain history size
    if (this.eventHistory.length > (this.config.maxHistorySize || 1000)) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxHistorySize);
    }

    // Persist to Redis if enabled
    if (this.config.enablePersistence && this.redisClient) {
      try {
        const key = this.config.persistenceKey || 'eventbus:history';
        await this.redisClient.lpush(key, JSON.stringify(event));
        await this.redisClient.ltrim(key, 0, (this.config.maxHistorySize || 1000) - 1);
      } catch (error) {
        logger.error('EventBus: Failed to persist event to Redis', {
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Publish an event with type safety
   */
  async publish<TType extends keyof TEventMap>(
    eventType: TType,
    payload: TEventMap[TType],
    metadata?: Partial<EventMetadata>
  ): Promise<void> {
    const event: BaseWebSocketEvent<TEventMap[TType]> = {
      id: uuidv4(),
      type: String(eventType),
      timestamp: new Date(),
      payload,
      metadata: {
        source: 'server',
        version: '1.0.0',
        ...metadata
      }
    };

    // Add to batch buffer if batching is enabled
    if (this.config.batchSize && this.config.batchSize > 1) {
      this.batchBuffer.push(event);
      if (this.batchBuffer.length >= this.config.batchSize) {
        await this.processBatch();
      }
      return;
    }

    await this.processEvent(event);
  }

  /**
   * Process a single event
   */
  private async processEvent(event: BaseWebSocketEvent): Promise<void> {
    try {
      // Add to history
      await this.addToHistory(event);

      // Get handlers for this event type
      const handlers = this.handlers.get(event.type) || new Set();
      
      // Execute through middleware pipeline
      await this.middlewareManager.execute(event, async () => {
        const promises = Array.from(handlers).map(({ handler, options }) => 
          this.executeHandler(event, handler, options)
        );
        
        await Promise.allSettled(promises);
      });

      // Emit to EventEmitter for backward compatibility
      this.emitter.emit(event.type, event);
      this.emitter.emit('*', event);

    } catch (error) {
      logger.error(`EventBus: Error processing event ${event.type}`, {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Execute a single handler with error isolation
   */
  private async executeHandler(
    event: BaseWebSocketEvent,
    handler: EventHandler,
    options: SubscriptionOptions
  ): Promise<void> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = options.retryCount || this.config.maxRetries || 3;

    while (retryCount <= maxRetries) {
      try {
        // Check filter if provided
        if (options.filter && !options.filter(event)) {
          return;
        }

        // Execute handler
        await handler(event);
        
        this.metrics.successfulHandlers++;
        return;

      } catch (error) {
        this.metrics.failedHandlers++;
        
        if (retryCount >= maxRetries) {
          logger.error(`EventBus: Handler failed after ${maxRetries} retries`, {
            eventId: event.id,
            eventType: event.type,
            error: error instanceof Error ? error.message : String(error),
            retryCount
          });
          
          if (!this.config.enableErrorIsolation) {
            throw error;
          }
          return;
        }

        // Wait before retry
        await new Promise(resolve => 
          setTimeout(resolve, (this.config.retryDelay || 1000) * Math.pow(2, retryCount))
        );
        retryCount++;
      }
    }
  }

  /**
   * Subscribe to events with type safety
   */
  subscribe<TType extends keyof TEventMap>(
    eventType: TType,
    handler: EventHandler<TEventMap[TType]>,
    options: SubscriptionOptions = {}
  ): () => void {
    const type = String(eventType);
    
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    const handlerWrapper = { handler, options };
    this.handlers.get(type)!.add(handlerWrapper);
    this.metrics.totalHandlers++;

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handlerWrapper);
        if (handlers.size === 0) {
          this.handlers.delete(type);
        }
        this.metrics.totalHandlers--;
      }
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll<TPayload = any>(
    handler: EventHandler<TPayload>,
    options: SubscriptionOptions = {}
  ): () => void {
    return this.subscribe('*', handler, options);
  }

  /**
   * Subscribe to event batches
   */
  subscribeBatches<TPayload = any>(
    handler: (batch: EventBatch<TPayload>) => void | Promise<void>
  ): () => void {
    this.emitter.on('batch', handler);
    
    return () => {
      this.emitter.off('batch', handler);
    };
  }

  /**
   * Add middleware to the event processing pipeline
   */
  use<TPayload = any>(middleware: EventMiddleware<TPayload>): void {
    this.middlewareManager.use(middleware);
  }

  /**
   * Get event metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get event history
   */
  async getHistory(limit?: number): Promise<BaseWebSocketEvent[]> {
    if (this.config.enablePersistence && this.redisClient) {
      try {
        const key = this.config.persistenceKey || 'eventbus:history';
        const events = await this.redisClient.lrange(key, 0, (limit || 100) - 1);
        return events.map(event => JSON.parse(event));
      } catch (error) {
        logger.error('EventBus: Failed to get history from Redis', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return this.eventHistory.slice(-limit || 100);
  }

  /**
   * Replay events from history
   */
  async replayEvents(
    filter?: (event: BaseWebSocketEvent) => boolean,
    limit?: number
  ): Promise<void> {
    const history = await this.getHistory(limit);
    const eventsToReplay = filter ? history.filter(filter) : history;
    
    for (const event of eventsToReplay) {
      await this.processEvent({ ...event, id: uuidv4() }); // Generate new ID for replayed events
    }
  }

  /**
   * Clear event history
   */
  async clearHistory(): Promise<void> {
    this.eventHistory = [];
    
    if (this.config.enablePersistence && this.redisClient) {
      try {
        const key = this.config.persistenceKey || 'eventbus:history';
        await this.redisClient.del(key);
      } catch (error) {
        logger.error('EventBus: Failed to clear history from Redis', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Get active handlers count
   */
  getHandlerCount(): number {
    return this.metrics.totalHandlers;
  }

  /**
   * Get handlers for a specific event type
   */
  getHandlersForType(eventType: string): number {
    return this.handlers.get(eventType)?.size || 0;
  }

  /**
   * Check if event type has registered handlers
   */
  hasHandlers(eventType: string): boolean {
    return (this.handlers.get(eventType)?.size || 0) > 0;
  }

  /**
   * Remove all handlers
   */
  removeAllHandlers(): void {
    this.handlers.clear();
    this.metrics.totalHandlers = 0;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Clear batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Process remaining batch
    if (this.batchBuffer.length > 0) {
      await this.processBatch();
    }

    // Disconnect Redis
    if (this.redisClient) {
      await this.redisClient.disconnect();
      this.redisClient = null;
    }

    // Remove all listeners
    this.emitter.removeAllListeners();
    
    logger.info('EventBus: Shutdown completed');
  }
}

// ============================================================================
// GLOBAL EVENT BUS INSTANCE
// ============================================================================

/**
 * Global event bus instance
 */
let globalEventBus: EventBus<any> | null = null;

/**
 * Get or create the global event bus instance
 */
export function getEventBus<TEventMap extends Record<string, any> = Record<string, any>>(
  config?: EventBusConfig
): EventBus<TEventMap> {
  if (!globalEventBus) {
    globalEventBus = new EventBus<TEventMap>(config);
  }
  return globalEventBus as EventBus<TEventMap>;
}

/**
 * Reset the global event bus instance
 */
export function resetEventBus(): void {
  if (globalEventBus) {
    globalEventBus.shutdown();
    globalEventBus = null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an event bus with WebSocket event types
 */
export function createWebSocketEventBus(config?: EventBusConfig): EventBus<Record<string, any>> {
  const bus = new EventBus<Record<string, any>>(config);
  
  // Register WebSocket event types
  // This would typically be done during application initialization
  // with the actual event schemas from the WebSocket event types
  
  return bus;
}

/**
 * Type-safe event publisher factory
 */
export function createEventPublisher<TEventMap extends Record<string, any>>(
  eventBus: EventBus<TEventMap>
) {
  return {
    publish: <TType extends keyof TEventMap>(
      eventType: TType,
      payload: TEventMap[TType],
      metadata?: Partial<EventMetadata>
    ) => eventBus.publish(eventType, payload, metadata)
  };
}

/**
 * Type-safe event subscriber factory
 */
export function createEventSubscriber<TEventMap extends Record<string, any>>(
  eventBus: EventBus<TEventMap>
) {
  return {
    subscribe: <TType extends keyof TEventMap>(
      eventType: TType,
      handler: EventHandler<TEventMap[TType]>,
      options?: SubscriptionOptions
    ) => eventBus.subscribe(eventType, handler, options)
  };
}