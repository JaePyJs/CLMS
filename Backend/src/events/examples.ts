import { 
  EventBus, 
  getEventBus, 
  createEventPublisher, 
  createEventSubscriber,
  loggingMiddleware,
  validationMiddleware,
  errorHandlingMiddleware,
  metricsMiddleware,
  EventFilter,
  SubscriptionOptions
} from './eventBus';
import { EVENT_TYPES, EVENT_CATEGORIES } from './eventTypes';
import { logger } from '../utils/logger';

// ============================================================================
// EVENT BUS USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Basic event publishing and subscribing
 */
export async function basicEventExample(): Promise<void> {
  const eventBus = getEventBus();
  
  // Subscribe to student creation events
  const unsubscribe = eventBus.subscribe('student:create', (event) => {
    logger.info('Student created:', {
      studentId: event.payload.studentId,
      firstName: event.payload.firstName,
      lastName: event.payload.lastName
    });
  });

  // Publish a student creation event
  await eventBus.publish('student:create', {
    studentId: 'STU001',
    firstName: 'John',
    lastName: 'Doe',
    gradeLevel: '10',
    section: 'A',
    email: 'john.doe@school.edu'
  });

  // Clean up
  unsubscribe();
}

/**
 * Example 2: Event filtering
 */
export async function eventFilteringExample(): Promise<void> {
  const eventBus = getEventBus();
  
  // Filter for high-priority events only
  const priorityFilter: EventFilter = (event) => {
    return event.metadata?.priority === 'high' || event.metadata?.priority === 'critical';
  };
  
  const unsubscribe = eventBus.subscribe(
    'system:notification', 
    (event) => {
      logger.warn('High priority notification:', event.payload);
    },
    { filter: priorityFilter }
  );

  // This event won't be processed (medium priority)
  await eventBus.publish('system:notification', {
    title: 'Regular Update',
    message: 'System maintenance scheduled',
    type: 'info' as const,
    priority: 'medium' as const
  }, {
    priority: 'medium' as const
  });

  // This event will be processed (high priority)
  await eventBus.publish('system:notification', {
    title: 'Critical Alert',
    message: 'Database connection failed',
    type: 'error' as const,
    priority: 'high' as const
  }, {
    priority: 'high' as const
  });

  unsubscribe();
}

/**
 * Example 3: Async event handlers
 */
export async function asyncEventHandlerExample(): Promise<void> {
  const eventBus = getEventBus();
  
  // Async handler for import completion
  const unsubscribe = eventBus.subscribe('import:completion', async (event) => {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('Import processing completed:', {
      importId: event.payload.importId,
      success: event.payload.success,
      processed: event.payload.processed
    });
    
    // Send notification or perform other async operations
    await sendImportNotification(event.payload);
  });

  // Publish import completion event
  await eventBus.publish('import:completion', {
    importId: 'IMP001',
    success: true,
    processed: 150,
    total: 150,
    created: 120,
    updated: 30,
    errors: [],
    warnings: ['5 duplicate entries found'],
    summary: {
      duration: 5000,
      recordsPerSecond: 30
    }
  });

  unsubscribe();
}

/**
 * Example 4: Custom middleware
 */
export async function customMiddlewareExample(): Promise<void> {
  const eventBus = new EventBus({
    enableMetrics: true,
    enableMiddleware: true
  });
  
  // Add custom authentication middleware
  eventBus.use((event, next) => {
    // Check if user has permission to handle this event
    if (event.userId && !hasPermission(event.userId, event.type)) {
      logger.warn('Unauthorized event access attempt:', {
        userId: event.userId,
        eventType: event.type
      });
      return;
    }
    
    next();
  });
  
  // Add custom transformation middleware
  eventBus.use((event, next) => {
    // Add timestamp to payload if not present
    if (!event.payload.processedAt) {
      event.payload.processedAt = new Date();
    }
    
    next();
  });
  
  // Subscribe with custom middleware
  eventBus.subscribe('book:checkout', (event) => {
    logger.info('Book checkout processed:', {
      bookId: event.payload.bookId,
      studentId: event.payload.studentId,
      processedAt: event.payload.processedAt
    });
  });

  // Publish event
  await eventBus.publish('book:checkout', {
    bookId: 'BOOK001',
    studentId: 'STU001',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  });
}

/**
 * Example 5: Event batching
 */
export async function eventBatchingExample(): Promise<void> {
  const eventBus = new EventBus({
    batchSize: 5,
    batchTimeout: 1000,
    enableMetrics: true
  });
  
  // Subscribe to batches
  const unsubscribeBatches = eventBus.subscribeBatches(async (batch) => {
    logger.info(`Processing batch of ${batch.size} events:`, {
      batchId: batch.id,
      eventTypes: batch.events.map(e => e.type)
    });
    
    // Process batch efficiently
    await processEventBatch(batch);
  });
  
  // Subscribe to individual events
  const unsubscribeIndividual = eventBus.subscribe('scanner:scan', (event) => {
    logger.info('Individual scan event:', event.payload.code);
  });
  
  // Publish multiple events quickly (they will be batched)
  for (let i = 0; i < 10; i++) {
    await eventBus.publish('scanner:scan', {
      code: `CODE${i.toString().padStart(3, '0')}`,
      scannerType: 'barcode' as const,
      timestamp: new Date()
    });
  }
  
  // Wait for batch processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  unsubscribeBatches();
  unsubscribeIndividual();
}

/**
 * Example 6: Event replay
 */
export async function eventReplayExample(): Promise<void> {
  const eventBus = new EventBus({
    enablePersistence: true,
    maxHistorySize: 100,
    redisInstanceName: 'default'
  });
  
  // Publish some events
  await eventBus.publish('student:create', {
    studentId: 'STU001',
    firstName: 'Alice',
    lastName: 'Smith',
    gradeLevel: '9'
  });
  
  await eventBus.publish('book:create', {
    bookId: 'BOOK001',
    title: 'Mathematics',
    author: 'John Doe',
    category: 'Education',
    totalCopies: 5,
    availableCopies: 5
  });
  
  // Get history
  const history = await eventBus.getHistory(10);
  logger.info('Event history:', history.length);
  
  // Replay only student events
  await eventBus.replayEvents(
    (event) => event.type.startsWith('student:'),
    5
  );
  
  // Clear history
  await eventBus.clearHistory();
}

/**
 * Example 7: Metrics and monitoring
 */
export async function metricsExample(): Promise<void> {
  const eventBus = new EventBus({
    enableMetrics: true
  });
  
  // Subscribe to events
  eventBus.subscribe('user:login', (event) => {
    logger.info('User logged in:', event.payload.username);
  });
  
  eventBus.subscribe('user:logout', (event) => {
    logger.info('User logged out:', event.payload.userId);
  });
  
  // Publish events
  for (let i = 0; i < 5; i++) {
    await eventBus.publish('user:login', {
      userId: `USER${i}`,
      username: `user${i}`,
      role: 'student',
      loginTime: new Date()
    });
    
    await eventBus.publish('user:logout', {
      userId: `USER${i}`,
      logoutTime: new Date(),
      sessionDuration: 3600000 // 1 hour
    });
  }
  
  // Get metrics
  const metrics = eventBus.getMetrics();
  logger.info('Event bus metrics:', {
    totalEvents: metrics.totalEvents,
    eventsByType: metrics.eventsByType,
    successfulHandlers: metrics.successfulHandlers,
    averageProcessingTime: metrics.averageProcessingTime
  });
}

/**
 * Example 8: Type-safe event publisher and subscriber
 */
export async function typeSafeExample(): Promise<void> {
  const eventBus = getEventBus();
  
  // Create type-safe publisher
  const publisher = createEventPublisher(eventBus);
  
  // Create type-safe subscriber
  const subscriber = createEventSubscriber(eventBus);
  
  // Subscribe with type safety
  const unsubscribe = subscriber.subscribe('book:create', (event) => {
    // TypeScript knows the exact payload type
    logger.info('Book created:', {
      title: event.payload.title,
      author: event.payload.author,
      category: event.payload.category
    });
  });
  
  // Publish with type safety
  await publisher.publish('book:create', {
    bookId: 'BOOK001',
    title: 'TypeScript Handbook',
    author: 'Anders Hejlsberg',
    category: 'Programming',
    totalCopies: 10,
    availableCopies: 10
  });
  
  unsubscribe();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Simulate sending import notification
 */
async function sendImportNotification(payload: any): Promise<void> {
  // Simulate API call or email sending
  await new Promise(resolve => setTimeout(resolve, 500));
  logger.info('Import notification sent:', payload.importId);
}

/**
 * Check if user has permission for event type
 */
function hasPermission(userId: string, eventType: string): boolean {
  // In a real application, this would check against a permissions system
  return true; // Simplified for example
}

/**
 * Process event batch efficiently
 */
async function processEventBatch(batch: any): Promise<void> {
  // Simulate batch processing
  await new Promise(resolve => setTimeout(resolve, 100));
  logger.info(`Batch ${batch.id} processed successfully`);
}

// ============================================================================
// DEMO FUNCTION
// ============================================================================

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  logger.info('Starting event bus examples...');
  
  try {
    await basicEventExample();
    await eventFilteringExample();
    await asyncEventHandlerExample();
    await customMiddlewareExample();
    await eventBatchingExample();
    await eventReplayExample();
    await metricsExample();
    await typeSafeExample();
    
    logger.info('All event bus examples completed successfully');
  } catch (error) {
    logger.error('Error running examples:', error);
  } finally {
    // Clean up global event bus
    const eventBus = getEventBus();
    await eventBus.shutdown();
  }
}

// Export examples for easy testing
export const examples = {
  basicEventExample,
  eventFilteringExample,
  asyncEventHandlerExample,
  customMiddlewareExample,
  eventBatchingExample,
  eventReplayExample,
  metricsExample,
  typeSafeExample,
  runAllExamples
};