# WebSocket API Contract

**Feature**: 002-frontend-stability-auth-testing  
**Protocol**: WebSocket (RFC 6455)  
**Authentication**: JWT via query parameter

## Connection

### Endpoint
```
ws://localhost:3001/ws?token=<JWT_ACCESS_TOKEN>
```

### Connection Flow

```
Client                                    Server
  │                                         │
  │ 1. GET /ws?token=<JWT>                 │
  │ ────────────────────────────────────▶  │
  │    Upgrade: websocket                   │
  │    Connection: Upgrade                  │
  │    Sec-WebSocket-Key: <key>            │
  │                                         │
  │                      2. Verify JWT ────┤
  │                         (jwt.verify)    │
  │                                         │
  │ 3. 101 Switching Protocols             │
  │ ◀────────────────────────────────────  │
  │    Upgrade: websocket                   │
  │    Connection: Upgrade                  │
  │    Sec-WebSocket-Accept: <hash>        │
  │                                         │
  │ 4. Connection established              │
  │ ═════════════════════════════════════▶ │
  │                                         │
```

### Authentication

**Query Parameter**:
- `token`: JWT access token (same as used in HTTP Authorization header)

**Validation**:
```typescript
const token = url.searchParams.get('token');
if (!token) {
  socket.close(1008, 'Token required'); // 1008 = Policy Violation
  return;
}

try {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  socket.userId = payload.userId;
  socket.username = payload.username;
  socket.role = payload.role;
} catch (error) {
  socket.close(1008, 'Invalid token');
  return;
}
```

**Close Codes**:
- `1008`: Policy Violation (missing or invalid token)
- `1000`: Normal Closure (client disconnect)
- `1001`: Going Away (server shutdown)
- `1006`: Abnormal Closure (connection lost)

---

## Message Format

All messages are JSON-encoded strings.

### Client → Server

```typescript
interface ClientMessage {
  type: 'ping' | 'subscribe' | 'unsubscribe';
  data?: any;
  timestamp?: string; // ISO 8601
}
```

### Server → Client

```typescript
interface ServerMessage {
  type: 'pong' | 'notification' | 'dashboard_update' | 'equipment_event' | 'checkout_update' | 'error';
  data: any;
  timestamp: string; // ISO 8601
}
```

---

## Event Types

### 1. Ping/Pong (Heartbeat)

**Purpose**: Keep connection alive, detect disconnections

**Client → Server**:
```json
{
  "type": "ping",
  "timestamp": "2025-01-06T10:30:00Z"
}
```

**Server → Client**:
```json
{
  "type": "pong",
  "data": {
    "serverTime": "2025-01-06T10:30:01Z",
    "connectionId": "conn_abc123"
  },
  "timestamp": "2025-01-06T10:30:01Z"
}
```

**Heartbeat Behavior**:
- Client sends ping every 30 seconds
- Server responds with pong within 5 seconds
- If no pong received, client attempts reconnect
- Server closes connection after 60 seconds of inactivity

---

### 2. Subscribe/Unsubscribe (Topic Management)

**Purpose**: Subscribe to specific event streams

**Client → Server (Subscribe)**:
```json
{
  "type": "subscribe",
  "data": {
    "topics": ["notifications", "dashboard", "equipment"]
  },
  "timestamp": "2025-01-06T10:30:00Z"
}
```

**Client → Server (Unsubscribe)**:
```json
{
  "type": "unsubscribe",
  "data": {
    "topics": ["equipment"]
  },
  "timestamp": "2025-01-06T10:30:00Z"
}
```

**Available Topics**:
- `notifications`: System notifications (checkouts, overdues, alerts)
- `dashboard`: Dashboard statistics updates
- `equipment`: Equipment session events (start, end, update)
- `checkout`: Checkout/checkin events

**Server → Client (Confirmation)**:
```json
{
  "type": "subscribe_ack",
  "data": {
    "topics": ["notifications", "dashboard", "equipment"],
    "subscribed": true
  },
  "timestamp": "2025-01-06T10:30:01Z"
}
```

**Default Subscriptions**:
- On connection: User automatically subscribed to `notifications` topic

---

### 3. Notification Events

**Purpose**: Real-time alerts and system notifications

**Server → Client**:
```json
{
  "type": "notification",
  "data": {
    "id": "notif_123",
    "category": "checkout",
    "priority": "info",
    "title": "Book Checked Out",
    "message": "Student John Doe checked out 'The Great Gatsby'",
    "metadata": {
      "studentId": "std_456",
      "bookId": "book_789",
      "checkoutId": "chk_101"
    },
    "createdAt": "2025-01-06T10:30:00Z"
  },
  "timestamp": "2025-01-06T10:30:01Z"
}
```

**Notification Categories**:
- `checkout`: Checkout/checkin events
- `overdue`: Overdue book alerts
- `equipment`: Equipment session events
- `system`: System messages (maintenance, updates)
- `alert`: Critical alerts (errors, failures)

**Notification Priorities**:
- `info`: Informational (default)
- `warning`: Warnings (overdue books, low stock)
- `error`: Errors (checkout failures, system issues)
- `critical`: Critical alerts (security, data loss)

---

### 4. Dashboard Update Events

**Purpose**: Real-time dashboard statistics

**Server → Client**:
```json
{
  "type": "dashboard_update",
  "data": {
    "totalStudents": 1234,
    "totalBooks": 5678,
    "activeCheckouts": 89,
    "overdueCheckouts": 12,
    "equipmentSessions": 5,
    "recentCheckouts": [
      {
        "id": "chk_101",
        "studentName": "John Doe",
        "bookTitle": "The Great Gatsby",
        "checkedOutAt": "2025-01-06T10:25:00Z"
      }
    ],
    "timestamp": "2025-01-06T10:30:00Z"
  },
  "timestamp": "2025-01-06T10:30:01Z"
}
```

**Update Frequency**:
- On data change (checkout, checkin, equipment session)
- Throttled to max 1 update per 5 seconds (prevent spam)

---

### 5. Equipment Event

**Purpose**: Real-time equipment usage tracking

**Server → Client**:
```json
{
  "type": "equipment_event",
  "data": {
    "event": "session_start",
    "session": {
      "id": "sess_123",
      "studentId": "std_456",
      "studentName": "John Doe",
      "equipmentId": "eq_789",
      "equipmentName": "3D Printer",
      "startedAt": "2025-01-06T10:30:00Z",
      "expectedEndAt": "2025-01-06T12:30:00Z"
    }
  },
  "timestamp": "2025-01-06T10:30:01Z"
}
```

**Equipment Events**:
- `session_start`: New equipment session started
- `session_end`: Equipment session ended
- `session_update`: Session extended or modified
- `equipment_available`: Equipment became available
- `equipment_unavailable`: Equipment out of service

---

### 6. Checkout Update

**Purpose**: Real-time checkout/checkin events

**Server → Client**:
```json
{
  "type": "checkout_update",
  "data": {
    "event": "checkout_created",
    "checkout": {
      "id": "chk_101",
      "studentId": "std_456",
      "studentName": "John Doe",
      "bookId": "book_789",
      "bookTitle": "The Great Gatsby",
      "checkedOutAt": "2025-01-06T10:30:00Z",
      "dueAt": "2025-01-20T10:30:00Z",
      "status": "active"
    }
  },
  "timestamp": "2025-01-06T10:30:01Z"
}
```

**Checkout Events**:
- `checkout_created`: New checkout
- `checkout_returned`: Book returned
- `checkout_renewed`: Checkout renewed
- `checkout_overdue`: Checkout became overdue

---

### 7. Error Events

**Purpose**: Client-side error handling

**Server → Client**:
```json
{
  "type": "error",
  "data": {
    "code": "SUBSCRIBE_FAILED",
    "message": "Failed to subscribe to topic 'invalid_topic'",
    "details": {
      "requestedTopics": ["invalid_topic"],
      "validTopics": ["notifications", "dashboard", "equipment", "checkout"]
    }
  },
  "timestamp": "2025-01-06T10:30:01Z"
}
```

**Error Codes**:
- `SUBSCRIBE_FAILED`: Topic subscription failed
- `UNSUBSCRIBE_FAILED`: Topic unsubscribe failed
- `INVALID_MESSAGE`: Malformed message from client
- `RATE_LIMITED`: Too many messages sent
- `INTERNAL_ERROR`: Server-side error

---

## Connection Lifecycle

### 1. Initial Connection

```typescript
// Client side
const token = localStorage.getItem('accessToken');
const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);

ws.onopen = () => {
  console.log('WebSocket connected');
  // Auto-subscribed to 'notifications' topic
};
```

### 2. Heartbeat Loop

```typescript
// Client side
let heartbeatInterval;

ws.onopen = () => {
  heartbeatInterval = setInterval(() => {
    ws.send(JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString()
    }));
  }, 30000); // Every 30 seconds
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'pong') {
    console.log('Heartbeat received');
  }
};

ws.onclose = () => {
  clearInterval(heartbeatInterval);
};
```

### 3. Reconnection Strategy

```typescript
// Client side
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

function connect() {
  const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);
  
  ws.onopen = () => {
    reconnectAttempts = 0; // Reset on successful connection
  };
  
  ws.onclose = (event) => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnect attempts reached, falling back to polling');
      startPolling(); // Fallback to HTTP polling
      return;
    }
    
    // Exponential backoff with jitter
    const delay = Math.min(
      BASE_DELAY * Math.pow(2, reconnectAttempts) + Math.random() * 1000,
      MAX_DELAY
    );
    
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
    reconnectAttempts++;
    
    setTimeout(() => connect(), delay);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    ws.close();
  };
}
```

### 4. Graceful Shutdown

```typescript
// Client side
function disconnect() {
  ws.close(1000, 'Client disconnecting'); // Normal closure
  clearInterval(heartbeatInterval);
}

// Server side
process.on('SIGTERM', () => {
  wss.clients.forEach((client) => {
    client.close(1001, 'Server shutting down'); // Going Away
  });
});
```

---

## Performance Considerations

### Message Size Limits
- **Max message size**: 1 MB (1048576 bytes)
- **Recommended**: Keep messages < 10 KB for optimal performance
- Large data should be fetched via HTTP API with WebSocket notification

### Rate Limiting
- **Client → Server**: Max 10 messages per second
- **Server → Client**: No hard limit, but throttled per topic
- Exceeding limit triggers `RATE_LIMITED` error

### Connection Limits
- **Per user**: 1 active connection (latest connection closes older ones)
- **Global**: Depends on server capacity (memory, file descriptors)

### Batching
- Dashboard updates batched (max 1 per 5 seconds)
- Notifications delivered immediately (no batching)

---

## Security Considerations

### Authentication
- ✅ JWT verified before connection upgrade
- ✅ Token must not be expired
- ✅ User must exist in database and be active
- ❌ Token NOT verified on every message (performance trade-off)

### Authorization
- Topic subscriptions filtered by user role:
  - `ADMIN`: All topics
  - `LIBRARIAN`: All except `system`
  - `ASSISTANT`: `notifications`, `checkout`

### Input Validation
- All client messages validated against schema
- Malformed JSON → socket closed with error
- Invalid message type → `INVALID_MESSAGE` error

### Rate Limiting
- Prevent abuse by limiting message rate
- Exceeding limit → temporary throttle, then close connection

---

## Error Handling

### Client-Side

```typescript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // Log to error tracking service
  logErrorToSentry(error);
};

ws.onclose = (event) => {
  if (event.code === 1008) {
    console.error('Authentication failed, redirecting to login');
    window.location.href = '/login';
  } else if (event.code === 1006) {
    console.warn('Connection lost, attempting reconnect');
    reconnect();
  }
};
```

### Server-Side

```typescript
ws.on('error', (error) => {
  console.error(`WebSocket error for user ${userId}:`, error);
  // Log to server monitoring
  logger.error('websocket_error', { userId, error });
});

ws.on('close', (code, reason) => {
  console.log(`WebSocket closed for user ${userId}: ${code} ${reason}`);
  // Clean up subscriptions
  unsubscribeAll(userId);
});
```

---

## Testing

### Manual Testing (Browser Console)

```javascript
// Connect
const token = localStorage.getItem('accessToken');
const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);

ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('Error:', e);
ws.onclose = (e) => console.log('Closed:', e.code, e.reason);

// Send ping
ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));

// Subscribe to topics
ws.send(JSON.stringify({ type: 'subscribe', data: { topics: ['dashboard', 'equipment'] } }));

// Disconnect
ws.close(1000, 'Done testing');
```

### Automated Testing (Vitest)

```typescript
// Backend/tests/integration/websocket.test.ts
import WebSocket from 'ws';

describe('WebSocket API', () => {
  it('should authenticate and connect', async () => {
    const token = await getTestToken();
    const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);
    
    await new Promise((resolve) => ws.on('open', resolve));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    
    ws.close();
  });
  
  it('should respond to ping with pong', async () => {
    const ws = await connectWebSocket();
    
    ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
    
    const response = await new Promise((resolve) => {
      ws.on('message', (data) => resolve(JSON.parse(data)));
    });
    
    expect(response.type).toBe('pong');
    ws.close();
  });
});
```

---

## Summary

**Protocol**: WebSocket (RFC 6455)  
**Authentication**: JWT via query parameter  
**Message Format**: JSON  
**Client Events**: 3 (ping, subscribe, unsubscribe)  
**Server Events**: 7 (pong, notification, dashboard_update, equipment_event, checkout_update, error, subscribe_ack)  
**Topics**: 4 (notifications, dashboard, equipment, checkout)  
**Reconnection**: Exponential backoff with jitter  
**Fallback**: HTTP polling after 5 failed reconnects  
**Close Codes**: 1000 (normal), 1001 (going away), 1006 (abnormal), 1008 (policy violation)  

**Next Step**: Create UI/UX specifications (ui-ux.md) ✅
