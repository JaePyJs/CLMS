// Main event bus exports
export {
  EventBus,
  getEventBus,
  resetEventBus,
  createWebSocketEventBus,
  createEventPublisher,
  createEventSubscriber
} from './eventBus';

// Type exports
export type {
  EventHandler,
  AsyncEventHandler,
  EventFilter,
  EventMiddleware,
  EventValidationSchema,
  EventBusConfig,
  EventMetrics,
  SubscriptionOptions,
  EventBatch
} from './eventBus';

// Registry exports
export {
  EventTypeRegistry
} from './eventBus';

// Middleware exports
export {
  EventMiddlewareManager,
  loggingMiddleware,
  validationMiddleware,
  errorHandlingMiddleware,
  metricsMiddleware
} from './eventBus';

// Event types integration
export * from './eventTypes';