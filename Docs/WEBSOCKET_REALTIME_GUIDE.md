# WebSocket Real-time Features Guide

## Overview

CLMS includes a comprehensive WebSocket implementation that enables real-time communication between the backend and frontend. This system supports live updates, collaborative features, instant notifications, and multi-user interactions.

## Architecture

### Server-Side Components

- **WebSocketManager**: Core server managing connections, authentication, and message routing
- **ClientManager**: Handles client connections, subscriptions, and broadcasting
- **EventHandlers**: Processes different types of WebSocket messages and events
- **Authentication Middleware**: Secures WebSocket connections with JWT validation

### Client-Side Components

- **WebSocketContext**: React context providing WebSocket connection to components
- **useWebSocket Hook**: Custom hook for WebSocket state management and event handling
- **Real-time Dashboard**: Components that consume live data updates

## Features

### 1. Connection Management

**Automatic Connection Handling:**
- Automatic reconnection with exponential backoff
- Connection status monitoring
- Graceful degradation when WebSocket is unavailable
- Support for multiple connection tabs per user (configurable limits)

**Authentication:**
- JWT-based authentication for all connections
- Role-based access control
- Rate limiting to prevent abuse
- Secure connection upgrade process

### 2. Real-time Events

**Live Activity Updates:**
```javascript
// Student check-in/out events
{
  type: 'activity_update',
  data: {
    studentId: 'student_123',
    activityType: 'CHECK_IN',
    timestamp: '2025-10-13T10:30:00Z',
    location: 'Main Library',
    equipmentId: 'computer_1'
  }
}
```

**Equipment Status Changes:**
```javascript
// Equipment availability updates
{
  type: 'equipment_update',
  data: {
    equipmentId: 'computer_1',
    status: 'AVAILABLE',
    lastUsedBy: 'student_456',
    duration: 7200
  }
}
```

**System Notifications:**
```javascript
// Real-time notifications
{
  type: 'notification',
  data: {
    id: 'notif_789',
    title: 'Time Limit Warning',
    message: 'Student John Doe has 10 minutes remaining',
    priority: 'MEDIUM',
    recipients: ['librarians']
  }
}
```

### 3. Subscription System

**Topic-Based Subscriptions:**
Clients can subscribe to specific topics to receive relevant updates:

```javascript
// Subscribe to activities
{
  type: 'subscribe',
  data: {
    topic: 'activities',
    filters: {
      activityType: ['CHECK_IN', 'CHECK_OUT'],
      location: 'Main Library'
    }
  }
}

// Subscribe to equipment updates
{
  type: 'subscribe',
  data: {
    topic: 'equipment',
    filters: {
      type: 'computer',
      status: ['IN_USE', 'AVAILABLE']
    }
  }
}

// Subscribe to notifications
{
  type: 'subscribe',
  data: {
    topic: 'notifications',
    filters: {
      priority: ['HIGH', 'CRITICAL'],
      role: 'LIBRARIAN'
    }
  }
}
```

**Available Subscription Topics:**
- `activities`: Student check-in/out, equipment usage
- `equipment`: Equipment status changes and availability
- `notifications`: System alerts and user notifications
- `dashboard`: Real-time dashboard metrics and statistics
- `analytics`: Usage analytics and insights
- `emergency`: Emergency alerts and system warnings
- `chat`: Inter-user messaging (future feature)
- `system`: System status and maintenance updates

### 4. Broadcasting System

**Role-Based Broadcasting:**
```javascript
// Broadcast to all librarians
webSocketManager.broadcastToRole('LIBRARIAN', {
  type: 'staff_alert',
  data: {
    message: 'Peak usage period starting',
    recommendations: ['Prepare additional resources']
  }
});

// Broadcast to all connected clients
webSocketManager.broadcast({
  type: 'system_announcement',
  data: {
    message: 'Library closing in 30 minutes',
    urgency: 'LOW'
  }
});
```

**Targeted Messaging:**
```javascript
// Send to specific user
webSocketManager.sendToUser('user_123', {
  type: 'personal_notification',
  data: {
    message: 'Your reserved book is available',
    actionRequired: true
  }
});
```

## WebSocket API Documentation

### Connection Endpoint

**WebSocket URL:** `ws://localhost:3002/ws` (development)
**Production URL:** `wss://your-domain.com/ws`

**Connection Headers:**
```javascript
// Required headers for authentication
{
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'User-Agent': 'CLMS-Frontend/1.0.0',
  'Origin': 'https://your-domain.com'
}
```

### Message Format

**Standard Message Structure:**
```javascript
{
  id: 'msg_1234567890_abc123',        // Unique message ID
  timestamp: '2025-10-13T10:30:00Z',  // ISO timestamp
  type: 'message_type',               // Message type
  data: {                              // Message payload
    // Type-specific data
  }
}
```

### Client-to-Server Messages

#### 1. Subscribe to Topic
```javascript
{
  type: 'subscribe',
  data: {
    topic: 'activities|equipment|notifications|dashboard|analytics|emergency|chat|system',
    filters?: {                        // Optional filters
      // Filter criteria based on topic
    }
  }
}
```

#### 2. Unsubscribe from Topic
```javascript
{
  type: 'unsubscribe',
  data: {
    topic: 'topic_name'
  }
}
```

#### 3. Ping (Keep-alive)
```javascript
{
  type: 'ping',
  data: {
    timestamp: '2025-10-13T10:30:00Z'
  }
}
```

#### 4. Get Connection Status
```javascript
{
  type: 'get_status',
  data: {}
}
```

### Server-to-Client Messages

#### 1. Welcome Message
```javascript
{
  type: 'welcome',
  data: {
    clientId: 'client_1234567890_abc123',
    userId: 'user_123',
    username: 'john_doe',
    role: 'LIBRARIAN',
    serverTime: '2025-10-13T10:30:00Z',
    availableSubscriptions: [
      'activities', 'equipment', 'notifications',
      'dashboard', 'analytics', 'emergency',
      'chat', 'system'
    ]
  }
}
```

#### 2. Activity Updates
```javascript
{
  type: 'activity_update',
  data: {
    id: 'activity_789',
    studentId: 'student_123',
    studentName: 'John Doe',
    activityType: 'CHECK_IN|CHECK_OUT|EQUIPMENT_USE|BOOK_BORROW|BOOK_RETURN',
    timestamp: '2025-10-13T10:30:00Z',
    location?: 'Main Library|AVR Room|Recreational Room',
    equipmentId?: 'equipment_456',
    equipmentName?: 'Student PC 1',
    duration?: 3600,
    metadata?: {
      // Additional activity-specific data
    }
  }
}
```

#### 3. Equipment Updates
```javascript
{
  type: 'equipment_update',
  data: {
    id: 'equipment_456',
    name: 'Student PC 1',
    type: 'COMPUTER|GAMING_CONSOLE|STUDY_ROOM',
    status: 'AVAILABLE|IN_USE|MAINTENANCE|OUT_OF_ORDER',
    currentUserId?: 'student_123',
    currentUserName?: 'John Doe',
    sessionStartTime?: '2025-10-13T09:00:00Z',
    sessionDuration?: 5400,
    location: 'Main Library',
    lastMaintenance?: '2025-10-01T00:00:00Z'
  }
}
```

#### 4. Notifications
```javascript
{
  type: 'notification',
  data: {
    id: 'notif_789',
    title: 'Notification Title',
    message: 'Detailed notification message',
    priority: 'LOW|MEDIUM|HIGH|CRITICAL',
    category: 'SYSTEM|USER|EQUIPMENT|BOOK|REMINDER',
    timestamp: '2025-10-13T10:30:00Z',
    actionable: true,
    actions?: [
      {
        id: 'action_1',
        label: 'View Details',
        url: '/activities/789'
      }
    ],
    expiresAt?: '2025-10-13T18:00:00Z'
  }
}
```

#### 5. Dashboard Updates
```javascript
{
  type: 'dashboard_update',
  data: {
    metrics: {
      totalStudents: 45,
      activeSessions: 12,
      equipmentInUse: 8,
      booksBorrowed: 23,
      overdueItems: 3
    },
    alerts: [
      {
        type: 'TIME_LIMIT_WARNING',
        message: '5 students approaching time limit',
        count: 5
      }
    ],
    timestamp: '2025-10-13T10:30:00Z'
  }
}
```

#### 6. Error Messages
```javascript
{
  type: 'error',
  data: {
    code: 'INVALID_MESSAGE|UNAUTHORIZED|RATE_LIMIT|SERVER_ERROR',
    message: 'Human-readable error message',
    details?: {
      // Additional error context
    },
    timestamp: '2025-10-13T10:30:00Z'
  }
}
```

## Integration Guide

### Frontend Integration

**Using the WebSocket Context:**
```javascript
import React, { useContext, useEffect } from 'react';
import { WebSocketContext } from '../contexts/WebSocketContext';
import { useWebSocket } from '../hooks/useWebSocket';

function RealTimeComponent() {
  const { isConnected, lastMessage, sendMessage } = useWebSocket();
  const { subscribe, unsubscribe } = useContext(WebSocketContext);

  useEffect(() => {
    // Subscribe to activity updates
    subscribe('activities', {
      activityType: ['CHECK_IN', 'CHECK_OUT']
    });

    // Cleanup on unmount
    return () => {
      unsubscribe('activities');
    };
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'activity_update':
          // Handle activity update
          console.log('New activity:', lastMessage.data);
          break;
        case 'equipment_update':
          // Handle equipment update
          console.log('Equipment status changed:', lastMessage.data);
          break;
        case 'notification':
          // Handle notification
          console.log('New notification:', lastMessage.data);
          break;
      }
    }
  }, [lastMessage]);

  const handleSendMessage = () => {
    sendMessage({
      type: 'subscribe',
      data: {
        topic: 'equipment',
        filters: { type: 'COMPUTER' }
      }
    });
  };

  return (
    <div>
      <div>Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <button onClick={handleSendMessage}>Subscribe to Equipment</button>
    </div>
  );
}
```

**Custom Hook for Real-time Data:**
```javascript
import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

export function useRealTimeActivities() {
  const [activities, setActivities] = useState([]);
  const { isConnected, lastMessage, sendMessage } = useWebSocket();

  useEffect(() => {
    if (isConnected) {
      // Subscribe to activities when connected
      sendMessage({
        type: 'subscribe',
        data: { topic: 'activities' }
      });
    }
  }, [isConnected, sendMessage]);

  useEffect(() => {
    if (lastMessage?.type === 'activity_update') {
      setActivities(prev => [lastMessage.data, ...prev.slice(0, 99)]); // Keep last 100
    }
  }, [lastMessage]);

  return { activities, isConnected };
}
```

### Backend Integration

**Broadcasting from Services:**
```javascript
import { webSocketManager } from '../websocket/websocketServer';

// In your activity service
async function checkInStudent(studentId: string, equipmentId?: string) {
  // Perform check-in logic...
  const activity = await createActivity(studentId, 'CHECK_IN', equipmentId);

  // Broadcast real-time update
  webSocketManager.broadcastToSubscription('activities', {
    type: 'activity_update',
    data: {
      id: activity.id,
      studentId: activity.studentId,
      studentName: activity.student.name,
      activityType: activity.activityType,
      timestamp: activity.startTime,
      equipmentId: activity.equipmentId,
      equipmentName: activity.equipment?.name
    }
  });

  // Send notification to librarians
  webSocketManager.broadcastToRole('LIBRARIAN', {
    type: 'notification',
    data: {
      title: 'Student Check-in',
      message: `${activity.student.name} checked in ${activity.equipment?.name ? `with ${activity.equipment.name}` : ''}`,
      priority: 'LOW',
      category: 'USER'
    }
  });

  return activity;
}
```

**Error Handling in WebSocket Handlers:**
```javascript
// In eventHandlers.ts
export const EventHandlers = {
  async handleMessage(ws: WebSocket, client: ClientConnection, message: WebSocketMessage) {
    try {
      switch (message.type) {
        case 'subscribe':
          await handleSubscription(client, message.data);
          break;
        case 'unsubscribe':
          await handleUnsubscription(client, message.data);
          break;
        case 'ping':
          await handlePing(client, message.data);
          break;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', {
        clientId: client.id,
        error: (error as Error).message,
        message
      });

      // Send error response
      webSocketManager.sendToUser(client.userId, {
        type: 'error',
        data: {
          code: 'MESSAGE_HANDLER_ERROR',
          message: 'Failed to process message',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
};
```

## User Guide

### For Librarians

**Real-time Dashboard:**
- View live student check-ins and equipment usage
- Receive instant notifications for important events
- Monitor library occupancy and resource allocation
- Get alerts for time limits and overdue items

**Live Notifications:**
- Student check-in/out alerts
- Equipment status changes
- Time limit warnings
- System maintenance notifications
- Emergency alerts

**Multi-tab Support:**
- Open multiple browser tabs for different views
- Each tab maintains its own WebSocket connection
- Synchronized updates across all tabs
- Maximum 5 connections per user (configurable)

### For System Administrators

**Connection Monitoring:**
- Real-time connection status and metrics
- User activity tracking
- Performance monitoring
- Error rate tracking

**Configuration Options:**
```javascript
// WebSocket server configuration
const config = {
  port: 3002,                        // WebSocket port
  path: '/ws',                       // WebSocket path
  auth: {
    requireAuth: true,               // Require authentication
    allowedRoles: ['ADMIN', 'LIBRARIAN', 'STAFF'],
    rateLimitEnabled: true,          // Enable rate limiting
    maxConnectionsPerUser: 5         // Max connections per user
  },
  enableCompression: true,           // Enable message compression
  maxPayload: 1024 * 1024,          // Max message size (1MB)
  heartbeatInterval: 30000           // Heartbeat interval (30 seconds)
};
```

## Troubleshooting

### Common Issues

#### 1. Connection Failures

**Symptoms:**
- WebSocket connection fails to establish
- "Authentication failed" errors
- Connection timeouts

**Solutions:**
```javascript
// Check if backend WebSocket server is running
fetch('http://localhost:3001/health')
  .then(response => response.json())
  .then(data => {
    if (data.websocket?.enabled) {
      console.log('WebSocket server is running');
    } else {
      console.error('WebSocket server is not enabled');
    }
  });

// Verify JWT token is valid
const token = localStorage.getItem('token');
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Date.now() / 1000) {
      console.error('Token has expired');
      // Refresh token or re-authenticate
    }
  } catch (error) {
    console.error('Invalid token format');
  }
}
```

#### 2. Message Not Received

**Symptoms:**
- Client doesn't receive real-time updates
- Messages sent but not delivered
- Subscription not working

**Solutions:**
```javascript
// Check subscription status
const checkSubscription = () => {
  sendMessage({
    type: 'get_status',
    data: {}
  });
};

// Re-subscribe if needed
const resubscribe = () => {
  sendMessage({
    type: 'subscribe',
    data: {
      topic: 'activities',
      filters: { activityType: ['CHECK_IN', 'CHECK_OUT'] }
    }
  });
};

// Monitor connection status
useEffect(() => {
  const interval = setInterval(() => {
    if (!isConnected) {
      console.warn('WebSocket disconnected, attempting reconnection...');
      // Reconnection handled automatically by useWebSocket hook
    }
  }, 5000);

  return () => clearInterval(interval);
}, [isConnected]);
```

#### 3. Performance Issues

**Symptoms:**
- High CPU usage
- Memory leaks
- Slow message delivery

**Solutions:**
```javascript
// Implement message batching for high-frequency updates
const batchMessages = (messages: WebSocketMessage[], delay: number = 100) => {
  const batch = {
    type: 'batch',
    data: {
      messages: messages,
      batchId: generateBatchId(),
      timestamp: new Date().toISOString()
    }
  };

  // Send batch instead of individual messages
  sendMessage(batch);
};

// Use debouncing for frequent updates
const debouncedUpdate = debounce((data) => {
  sendMessage({
    type: 'activity_update',
    data
  });
}, 250);

// Cleanup resources on unmount
useEffect(() => {
  return () => {
    // Unsubscribe from all topics
    subscriptions.forEach(topic => {
      sendMessage({
        type: 'unsubscribe',
        data: { topic }
      });
    });
  };
}, []);
```

### Debug Mode

**Enable Debug Logging:**
```javascript
// In development, enable debug logging
if (process.env.NODE_ENV === 'development') {
  localStorage.setItem('ws_debug', 'true');
}

// WebSocket hook will log all messages in debug mode
const useWebSocket = () => {
  const [debug, setDebug] = useState(localStorage.getItem('ws_debug') === 'true');

  useEffect(() => {
    if (debug) {
      console.log('WebSocket Debug Mode Enabled');
    }
  }, [debug]);

  // Rest of hook implementation...
};
```

### Monitoring and Analytics

**Connection Metrics:**
```javascript
// Monitor connection health
const connectionMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  messagesPerSecond: 0,
  errorRate: 0,
  averageLatency: 0
};

// Get server status
const getServerStatus = async () => {
  const response = await fetch('/api/websocket/status');
  const status = await response.json();

  console.log('WebSocket Server Status:', status);
  return status;
};
```

## Best Practices

### Security

1. **Always validate JWT tokens** before establishing connections
2. **Implement rate limiting** to prevent abuse
3. **Sanitize and validate** all incoming messages
4. **Use role-based access control** for subscriptions
5. **Log all connection attempts** for security auditing

### Performance

1. **Implement message batching** for high-frequency updates
2. **Use debouncing** for rapid successive updates
3. **Monitor memory usage** and cleanup resources
4. **Implement backpressure** handling for slow clients
5. **Use compression** for large messages

### Reliability

1. **Implement automatic reconnection** with exponential backoff
2. **Provide fallback mechanisms** when WebSocket is unavailable
3. **Queue important messages** for delivery when connection is restored
4. **Implement heartbeat/ping-pong** for connection health
5. **Handle edge cases** like network interruptions

### Scalability

1. **Use connection pooling** for database operations
2. **Implement horizontal scaling** with Redis adapter for multiple server instances
3. **Monitor resource usage** and optimize accordingly
4. **Use message queues** for background processing
5. **Implement load balancing** for WebSocket connections

## FAQ

**Q: How many concurrent connections can the WebSocket server handle?**
A: The server is configured to handle 100+ concurrent connections by default. This can be increased by adjusting system limits and server configuration.

**Q: What happens if the WebSocket connection is lost?**
A: The client automatically attempts to reconnect with exponential backoff. Messages are queued locally and sent when the connection is restored.

**Q: Can I use WebSocket connections on mobile devices?**
A: Yes, WebSocket connections work on mobile browsers. The system automatically adjusts reconnection intervals for mobile networks.

**Q: How secure are WebSocket connections?**
A: All connections require JWT authentication and use the same security mechanisms as the main API. Messages are encrypted when using HTTPS/WSS.

**Q: Can I integrate WebSocket with external systems?**
A: Yes, the WebSocket system can be integrated with external systems through the REST API endpoints that trigger real-time updates.

## API Reference

### WebSocket Manager Methods

```javascript
// Broadcast to all clients
webSocketManager.broadcast(message, excludeClientId?)

// Send to specific user
webSocketManager.sendToUser(userId, message)

// Broadcast to clients with specific role
webSocketManager.broadcastToRole(role, message, excludeClientId?)

// Broadcast to subscribed clients
webSocketManager.broadcastToSubscription(subscription, message, excludeClientId?)

// Get server status
webSocketManager.getStatus()

// Graceful shutdown
webSocketManager.shutdown()
```

### Client Manager Methods

```javascript
// Add client connection
clientManager.addClient(clientConnection)

// Remove client connection
clientManager.removeClient(clientId)

// Update client activity
clientManager.updateClientActivity(clientId)

// Get connection statistics
clientManager.getStats()

// Client cleanup
clientManager.shutdown()
```

### Event Types

```javascript
// Client-to-Server events
'SUBSCRIBE'        // Subscribe to topic
'UNSUBSCRIBE'      // Unsubscribe from topic
'PING'            // Keep-alive ping
'GET_STATUS'      // Get connection status

// Server-to-Client events
'WELCOME'         // Connection welcome message
'ACTIVITY_UPDATE' // Activity status changes
'EQUIPMENT_UPDATE'// Equipment status changes
'NOTIFICATION'    // System notifications
'DASHBOARD_UPDATE'// Dashboard metrics
'ERROR'           // Error messages
'BATCH'           // Batched messages
```

---

This WebSocket implementation provides a robust foundation for real-time features in CLMS, enabling live updates, instant notifications, and multi-user collaboration while maintaining security and performance standards.