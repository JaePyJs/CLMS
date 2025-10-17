# Event Bus System

A type-safe, feature-rich event bus system for the CLMS backend that provides centralized event management with middleware support, persistence, and comprehensive monitoring.

## Features

- **Type Safety**: Full TypeScript support with generic event types and payload validation
- **Middleware Pipeline**: Extensible middleware system for cross-cutting concerns
- **Event Filtering**: Advanced filtering capabilities for selective event processing
- **Async Support**: Native support for async event handlers with Promise handling
- **Event Persistence**: Redis-based event storage with fallback to in-memory
- **Event Replay**: Replay events from history with filtering options
- **Batch Processing**: Efficient batch processing for high-frequency events
- **Metrics & Monitoring**: Built-in metrics collection and performance monitoring
- **Error Isolation**: Robust error handling with configurable retry mechanisms
- **Event Registry**: Centralized event type registration and validation

## Installation

The event bus system is already integrated into the CLMS backend. Simply import the required modules:

```typescript
import { 
  EventBus, 
  getEventBus, 
  createEventPublisher,
  createEventSubscriber 
} from '../events';
```

## Quick Start

### Basic Usage

```typescript
import { getEventBus } from '../events';

// Get the global event bus instance
const eventBus = getEventBus();

// Subscribe to events
const unsubscribe = eventBus.subscribe('student:create', (event) => {
  console.log('Student created:', event.payload);
});

// Publish events
await eventBus.publish('student:create', {
  studentId: 'STU001',
  firstName: 'John',
  lastName: 'Doe',
  gradeLevel: '10'
});

// Clean up
unsubscribe();
```

### Type-Safe Usage

```typescript
import { createEventPublisher, createEventSubscriber } from '../events';

const eventBus = getEventBus();

// Create type-safe publisher and subscriber
const publisher = createEventPublisher(eventBus);
const subscriber = createEventSubscriber(eventBus);

// Subscribe with type safety
const unsubscribe = subscriber.subscribe('book:create', (event) => {
  // TypeScript knows the exact payload type
  console.log('Book title:', event.payload.title);
});

// Publish with type safety
await publisher.publish('book:create', {
  bookId: 'BOOK001',
  title: 'TypeScript Handbook',
  author: 'John Doe',
  category: 'Programming',
  totalCopies: 10,
  availableCopies: 10
});
```

## Core Concepts

### Event Structure

All events follow the `BaseWebSocketEvent` interface:

```typescript
interface BaseWebSocketEvent<TPayload = any> {
  id: string;           // Unique event identifier
  type: string;         // Event type identifier
  timestamp: Date;      // Event creation time
  userId?: string;      // User who triggered the event
  sessionId?: string;   // Session identifier
  payload: TPayload;    // Event payload data
  metadata?: EventMetadata; // Additional metadata
}
```

### Event Types

The system includes predefined event types for all CLMS entities:

- **Student Events**: `student:create`, `student:update`, `student:delete`, `student:checkout`, `student:return`
- **Book Events**: `book:create`, `book:update`, `book:delete`, `book:checkout`, `book:return`, `book:reserve`
- **Equipment Events**: `equipment:create`, `equipment:update`, `equipment:delete`, `equipment:checkout`, `equipment:return`, `equipment:reserve`
- **System Events**: `system:notification`, `system:alert`, `system:status`
- **Import Events**: `import:start`, `import:progress`, `import:completion`
- **User Events**: `user:login`, `user:logout`, `user:permissions`, `user:preferences`
- **Scanner Events**: `scanner:scan`, `scanner:result`

## Advanced Features

### Middleware

Add custom middleware to the event processing pipeline:

```typescript
import { loggingMiddleware, validationMiddleware } from '../events';

const eventBus = new EventBus({
  enableMiddleware: true
});

// Add built-in middleware
eventBus.use(loggingMiddleware('info'));
eventBus.use(validationMiddleware());

// Add custom middleware
eventBus.use(async (event, next) => {
  console.log(`Processing ${event.type}`);
  await next();
  console.log(`Finished processing ${event.type}`);
});
```

### Built-in Middleware

- **Logging Middleware**: Logs event processing with configurable log levels
- **Validation Middleware**: Validates event payloads against registered schemas
- **Error Handling Middleware**: Centralized error handling with custom error handlers
- **Metrics Middleware**: Collects performance metrics for event processing

### Event Filtering

Filter events before they reach handlers:

```typescript
const highPriorityFilter = (event) => {
  return event.metadata?.priority === 'high' || event.metadata?.priority === 'critical';
};

eventBus.subscribe(
  'system:notification',
  (event) => {
    // Only receives high-priority notifications
    console.log('High priority alert:', event.payload);
  },
  { filter: highPriorityFilter }
);
```

### Async Event Handlers

Native support for async event handlers:

```typescript
eventBus.subscribe('import:completion', async (event) => {
  // Perform async operations
  await sendEmailNotification(event.payload);
  await updateDatabase(event.payload);
  await logMetrics(event.payload);
});
```

### Event Persistence

Configure Redis-based persistence:

```typescript
const eventBus = new EventBus({
  enablePersistence: true,
  redisInstanceName: 'default',
  maxHistorySize: 1000,
  persistenceKey: 'clms:events'
});
```

### Event Replay

Replay events from history:

```typescript
// Replay all events
await eventBus.replayEvents();

// Replay filtered events
await eventBus.replayEvents(
  (event) => event.type.startsWith('student:'),
  100 // limit to 100 events
);

// Get event history
const history = await eventBus.getHistory(50);
```

### Batch Processing

Enable batch processing for high-frequency events:

```typescript
const eventBus = new EventBus({
  batchSize: 10,        // Process in batches of 10
  batchTimeout: 1000    // Or every 1 second
});

// Subscribe to batches
eventBus.subscribeBatches(async (batch) => {
  console.log(`Processing batch of ${batch.size} events`);
  // Process entire batch efficiently
});
```

### Metrics and Monitoring

Access event bus metrics:

```typescript
const metrics = eventBus.getMetrics();
console.log('Event bus metrics:', {
  totalEvents: metrics.totalEvents,
  eventsByType: metrics.eventsByType,
  successfulHandlers: metrics.successfulHandlers,
  failedHandlers: metrics.failedHandlers,
  averageProcessingTime: metrics.averageProcessingTime
});
```

## Configuration Options

```typescript
interface EventBusConfig {
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
```

## Event Type Registration

Register custom event types with validation:

```typescript
import { EventTypeRegistry } from '../events';
import { z } from 'zod';

// Define schema
const CustomEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number()
});

// Register event type
EventTypeRegistry.registerEventType(
  'custom:event',
  CustomEventSchema,
  CustomEventPayload,
  'custom'
);
```

## Error Handling

The event bus provides robust error handling:

```typescript
const eventBus = new EventBus({
  enableErrorIsolation: true,  // Isolate errors between handlers
  maxRetries: 3,              // Retry failed handlers
  retryDelay: 1000           // Delay between retries
});

// Custom error handling middleware
eventBus.use(errorHandlingMiddleware((error, event) => {
  console.error(`Error in ${event.type}:`, error);
  // Send to error tracking service
}));
```

## Integration with WebSocket Events

The event bus integrates seamlessly with existing WebSocket event types:

```typescript
import { EVENT_TYPES } from '../events';

// Use predefined event type constants
await eventBus.publish(EVENT_TYPES.STUDENT_CREATE, {
  studentId: 'STU001',
  firstName: 'John',
  lastName: 'Doe',
  gradeLevel: '10'
});
```

## Best Practices

1. **Use Type Safety**: Always use the type-safe publisher and subscriber factories
2. **Handle Errors**: Implement proper error handling in event handlers
3. **Use Filters**: Apply filters to reduce unnecessary event processing
4. **Monitor Metrics**: Regularly check event bus metrics for performance issues
5. **Clean Up**: Always unsubscribe from events when no longer needed
6. **Batch High-Frequency Events**: Use batch processing for events like scanner scans
7. **Validate Payloads**: Use the validation middleware to ensure data integrity

## Examples

See [`examples.ts`](./examples.ts) for comprehensive usage examples including:

- Basic event publishing and subscribing
- Event filtering
- Async event handlers
- Custom middleware
- Event batching
- Event replay
- Metrics and monitoring
- Type-safe usage

## API Reference

### Core Classes

- **EventBus**: Main event bus implementation
- **EventTypeRegistry**: Event type registration and validation
- **EventMiddlewareManager**: Middleware pipeline management

### Utility Functions

- **getEventBus()**: Get global event bus instance
- **createEventPublisher()**: Create type-safe event publisher
- **createEventSubscriber()**: Create type-safe event subscriber
- **createWebSocketEventBus()**: Create event bus with WebSocket types

### Middleware

- **loggingMiddleware()**: Add logging to event processing
- **validationMiddleware()**: Validate event payloads
- **errorHandlingMiddleware()**: Handle errors in event processing
- **metricsMiddleware()**: Collect performance metrics

## Troubleshooting

### Common Issues

1. **Events Not Being Processed**: Check if handlers are properly registered and not being filtered out
2. **Performance Issues**: Enable metrics and monitor processing times, consider batch processing
3. **Memory Leaks**: Ensure proper cleanup with unsubscribe functions
4. **Redis Connection Issues**: Check Redis configuration and connection status

### Debug Mode

Enable debug logging:

```typescript
const eventBus = new EventBus({
  enableMiddleware: true
});

eventBus.use(loggingMiddleware('debug'));
```

## Contributing

When adding new event types:

1. Define the payload interface in `../websocket/eventTypes.ts`
2. Create the Zod schema in `eventTypes.ts`
3. Register the event type in the initialization function
4. Add the event type constant
5. Update documentation

## License

This event bus system is part of the CLMS project and follows the same license terms.