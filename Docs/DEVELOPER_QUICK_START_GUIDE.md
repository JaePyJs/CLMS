# Developer Quick Start Guide

## Overview

This guide provides developers with quick start instructions and integration examples for working with the CLMS (Comprehensive Library Management System) API, WebSocket connections, and advanced features.

### 🚀 New in Version 2.0 (October 2025)

- **Enhanced TypeScript Support**: Full TypeScript 5.0+ with advanced type inference
- **Repository Pattern**: New data access layer with flexible ID handling
- **Flexible Import System**: Revolutionary data import capabilities
- **Type-Safe Development**: Comprehensive type safety across the entire stack
- **Enhanced Developer Experience**: Better IntelliSense and error handling

## Prerequisites

### Development Environment
- **Node.js**: v20+ (LTS version recommended)
- **npm**: v9+ or yarn v1.22+
- **Git**: Latest version
- **Database**: MySQL 8.0+ (for local development)
- **Redis**: v6.0+ (for caching and queues)

### Required Tools
- **IDE**: VS Code, WebStorm, or similar
- **API Client**: Postman, Insomnia, or similar
- **Database Client**: MySQL Workbench, DBeaver, or similar
- **Git Client**: Git CLI, GitHub Desktop, or similar

## Enhanced TypeScript Development

### TypeScript 5.0+ Features

The CLMS system leverages TypeScript 5.0+ features for enhanced developer experience:

- **Strict Type Checking**: Comprehensive type safety with strict mode enabled
- **Advanced Type Inference**: Smart type deduction reduces boilerplate code
- **Generic Repository Pattern**: Type-safe data access with flexible querying
- **Branded Types**: Type-safe identifier handling
- **Template Literal Types**: Type-safe string manipulation and validation

### Repository Pattern Development

The new repository pattern provides a clean separation between business logic and data access:

```typescript
// Example: Using the StudentsRepository
import { StudentsRepository } from './repositories/students.repository';
import { StudentService } from './services/studentService';

// Initialize repository
const studentsRepository = new StudentsRepository(prisma);

// Use flexible ID handling
const student = await studentsRepository.findByAnyId('STU001'); // Works with any ID type

// Create new student with type safety
const newStudent = await studentsRepository.create({
  studentId: 'STU002',
  firstName: 'Jane',
  lastName: 'Smith',
  gradeLevel: 'Grade 8',
  gradeCategory: 'JUNIOR_HIGH',
  section: '8-B'
});
```

### Type-Safe API Development

All API endpoints now provide full TypeScript support:

```typescript
// Example: Type-safe API client
import { apiClient } from './lib/api';
import type { Student, CreateStudentData } from './types';

// Type-safe student creation
const studentData: CreateStudentData = {
  studentId: 'STU003',
  firstName: 'John',
  lastName: 'Doe',
  gradeLevel: 'Grade 9',
  gradeCategory: 'JUNIOR_HIGH',
  section: '9-A'
};

const response = await apiClient.post<Student>('/students', studentData);
if (response.success && response.data) {
  // response.data is fully typed as Student
  console.log(response.data.firstName); // TypeScript knows this is a string
}
```

## Quick Setup

### 1. Clone and Setup Repository

```bash
# Clone the repository
git clone https://github.com/your-org/clms.git
cd clms

# Install dependencies for both frontend and backend
npm run install:all

# Or install separately
cd Backend && npm install
cd ../Frontend && npm install
```

### 2. Database Setup

```bash
# Copy environment template
cd Backend
cp .env.example .env

# Edit environment variables
nano .env

# Generate Prisma client
npx prisma generate

# Apply database schema
npx prisma db push

# (Optional) Seed with sample data
npx prisma db seed
```

### 3. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start separately
# Terminal 1 - Backend
cd Backend && npm run dev

# Terminal 2 - Frontend
cd Frontend && npm run dev
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs
- **Database Studio**: http://localhost:5555 (Prisma Studio)

## API Integration Examples

### JavaScript/TypeScript Client

#### Basic API Client Setup
```typescript
// src/lib/api.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class CLMSApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3001/api') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Handle common errors
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(credentials: { username: string; password: string }) {
    return this.client.post('/auth/login', credentials);
  }

  async logout() {
    return this.client.post('/auth/logout');
  }

  // Students
  async getStudents(params?: {
    gradeCategory?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    return this.client.get('/students', { params });
  }

  async getStudent(id: string) {
    return this.client.get(`/students/${id}`);
  }

  async createStudent(studentData: {
    studentId: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    gradeCategory: string;
    section: string;
  }) {
    return this.client.post('/students', studentData);
  }

  async updateStudent(id: string, studentData: Partial<{
    firstName: string;
    lastName: string;
    gradeLevel: string;
    section: string;
    isActive: boolean;
  }>) {
    return this.client.put(`/students/${id}`, studentData);
  }

  // Activities
  async getStudentActivities(params?: {
    studentId?: string;
    startDate?: string;
    endDate?: string;
    activityType?: string;
    status?: string;
  }) {
    return this.client.get('/students/activities/all', { params });
  }

  async createActivity(activityData: {
    studentId: string;
    activityType: string;
    equipmentId?: string;
    timeLimitMinutes?: number;
    notes?: string;
  }) {
    return this.client.post('/students/activities', activityData);
  }

  async endActivity(activityId: string) {
    return this.client.patch(`/students/activities/${activityId}/end`);
  }

  // Equipment
  async getEquipment() {
    return this.client.get('/equipment');
  }

  async getEquipmentStatus(id: string) {
    return this.client.get(`/equipment/${id}`);
  }

  async updateEquipmentStatus(id: string, status: string) {
    return this.client.put(`/equipment/${id}`, { status });
  }

  // Analytics
  async getPredictiveInsights(params?: {
    timeframe?: 'day' | 'week' | 'month';
    category?: string;
    confidence?: number;
  }) {
    return this.client.get('/analytics/predictive-insights', { params });
  }

  async getUsageHeatMap(params?: {
    timeframe?: 'day' | 'week' | 'month';
    activityType?: string;
    gradeLevel?: string;
  }) {
    return this.client.get('/analytics/heat-map', { params });
  }

  async getTimeSeriesForecast(params: {
    metric: 'student_visits' | 'equipment_usage' | 'book_circulation';
    timeframe?: 'day' | 'week' | 'month';
    periods?: number;
  }) {
    return this.client.get('/analytics/time-series-forecast', { params });
  }

  // Self-Service
  async scanStudent(barcode: string, location?: string) {
    return this.client.post('/self-service/scan', { barcode, location });
  }

  async getStudentStatus(scanData: string) {
    return this.client.get(`/self-service/status/${scanData}`);
  }

  // Notifications
  async getNotifications(params?: {
    unread?: boolean;
    type?: string;
    limit?: number;
  }) {
    return this.client.get('/notifications', { params });
  }

  async markNotificationAsRead(notificationId: string) {
    return this.client.put(`/notifications/${notificationId}/read`);
  }

  // Error Reporting
  async reportError(error: {
    message: string;
    stack?: string;
    component?: string;
    userAgent?: string;
    url?: string;
  }) {
    return this.client.post('/errors/report', { error });
  }
}

// Export singleton instance
export const apiClient = new CLMSApiClient();

// Export individual methods for convenience
export const {
  login,
  logout,
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  getStudentActivities,
  createActivity,
  endActivity,
  getEquipment,
  getPredictiveInsights,
  getUsageHeatMap,
  getTimeSeriesForecast,
  scanStudent,
  getNotifications,
  markNotificationAsRead,
  reportError
} = apiClient;
```

#### React Hook for API Integration
```typescript
// src/hooks/useCLMSApi.ts
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

export function useApi<T>(
  apiCall: () => Promise<T>,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
      options.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      options.onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [apiCall, options]);

  useEffect(() => {
    if (options.immediate) {
      execute();
    }
  }, [execute, options.immediate]);

  return { data, loading, error, execute, refetch: execute };
}

// Specific hooks for common operations
export function useStudents(params?: {
  gradeCategory?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  return useApi(
    () => apiClient.getStudents(params),
    { immediate: true }
  );
}

export function useStudent(id: string) {
  return useApi(
    () => apiClient.getStudent(id),
    { immediate: !!id }
  );
}

export function useStudentActivities(params?: {
  studentId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useApi(
    () => apiClient.getStudentActivities(params),
    { immediate: true }
  );
}

export function usePredictiveInsights(timeframe: 'day' | 'week' | 'month' = 'week') {
  return useApi(
    () => apiClient.getPredictiveInsights({ timeframe }),
    { immediate: true }
  );
}

export function useUsageHeatMap(timeframe: 'day' | 'week' | 'month' = 'week') {
  return useApi(
    () => apiClient.getUsageHeatMap({ timeframe }),
    { immediate: true }
  );
}
```

### Python Integration Example

#### Python Client Library
```python
# clms_client.py
import requests
import json
from typing import Optional, Dict, Any, List
from datetime import datetime

class CLMSClient:
    def __init__(self, base_url: str = "http://localhost:3001/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None

        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def login(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate and store token"""
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"username": username, "password": password}
        )
        response.raise_for_status()

        data = response.json()
        if data.get('success'):
            self.token = data['data']['token']
            self.session.headers.update({
                'Authorization': f'Bearer {self.token}'
            })

        return data

    def logout(self) -> Dict[str, Any]:
        """Logout and clear token"""
        response = self.session.post(f"{self.base_url}/auth/logout")
        if self.token:
            del self.session.headers['Authorization']
            self.token = None
        return response.json()

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Internal method to make API requests"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()

    # Student Management
    def get_students(self, **params) -> Dict[str, Any]:
        """Get list of students"""
        return self._make_request('GET', '/students', params=params)

    def get_student(self, student_id: str) -> Dict[str, Any]:
        """Get specific student"""
        return self._make_request('GET', f'/students/{student_id}')

    def create_student(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new student"""
        return self._make_request('POST', '/students', json=student_data)

    def update_student(self, student_id: str, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update student information"""
        return self._make_request('PUT', f'/students/{student_id}', json=student_data)

    # Activity Management
    def get_student_activities(self, **params) -> Dict[str, Any]:
        """Get student activities"""
        return self._make_request('GET', '/students/activities/all', params=params)

    def create_activity(self, activity_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new activity"""
        return self._make_request('POST', '/students/activities', json=activity_data)

    def end_activity(self, activity_id: str) -> Dict[str, Any]:
        """End activity"""
        return self._make_request('PATCH', f'/students/activities/{activity_id}/end')

    # Analytics
    def get_predictive_insights(self, **params) -> Dict[str, Any]:
        """Get predictive insights"""
        return self._make_request('GET', '/analytics/predictive-insights', params=params)

    def get_usage_heat_map(self, **params) -> Dict[str, Any]:
        """Get usage heat map data"""
        return self._make_request('GET', '/analytics/heat-map', params=params)

    def get_time_series_forecast(self, metric: str, **params) -> Dict[str, Any]:
        """Get time series forecast"""
        params['metric'] = metric
        return self._make_request('GET', '/analytics/time-series-forecast', params=params)

    # Equipment
    def get_equipment(self) -> Dict[str, Any]:
        """Get all equipment"""
        return self._make_request('GET', '/equipment')

    def get_equipment_status(self, equipment_id: str) -> Dict[str, Any]:
        """Get equipment status"""
        return self._make_request('GET', f'/equipment/{equipment_id}')

    # Self-Service
    def scan_student(self, barcode: str, location: Optional[str] = None) -> Dict[str, Any]:
        """Scan student barcode for self-service"""
        data = {"barcode": barcode}
        if location:
            data["location"] = location
        return self._make_request('POST', '/self-service/scan', json=data)

    def get_student_status(self, scan_data: str) -> Dict[str, Any]:
        """Get student status by scan data"""
        return self._make_request('GET', f'/self-service/status/{scan_data}')

# Usage Example
if __name__ == "__main__":
    # Initialize client
    client = CLMSClient()

    try:
        # Login
        auth_result = client.login("admin", "password")
        print("Login successful:", auth_result['data']['user']['username'])

        # Get students
        students = client.get_students(isActive=True, limit=10)
        print(f"Found {len(students['data']['students'])} active students")

        # Get predictive insights
        insights = client.get_predictive_insights(timeframe='week')
        print(f"Generated {len(insights['data'])} insights")

        # Get usage heat map
        heat_map = client.get_usage_heat_map(timeframe='week')
        print(f"Heat map has {len(heat_map['data'])} data points")

        # Logout
        client.logout()
        print("Logged out successfully")

    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
```

## WebSocket Integration Examples

### JavaScript WebSocket Client
```typescript
// src/lib/websocket.ts
type WebSocketMessage = {
  id: string;
  timestamp: string;
  type: string;
  data: any;
};

type SubscriptionOptions = {
  topic: string;
  filters?: Record<string, any>;
};

class CLMSWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private subscriptions: Set<string> = new Set();
  private messageHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string = 'ws://localhost:3002/ws') {
    this.url = url;
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.token = token;

      try {
        this.ws = new WebSocket(this.url, [], {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason);
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      console.log('Received WebSocket message:', message);

      // Call specific message handlers
      const handlers = this.messageHandlers.get(message.type) || [];
      handlers.forEach(handler => handler(message.data));

      // Call general message handler
      const generalHandlers = this.messageHandlers.get('*') || [];
      generalHandlers.forEach(handler => handler(message));
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.token) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect(this.token!).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    }
  }

  subscribe(options: SubscriptionOptions) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot subscribe');
      return;
    }

    const subscriptionKey = JSON.stringify(options);

    if (this.subscriptions.has(subscriptionKey)) {
      console.log('Already subscribed to:', options);
      return;
    }

    const message = {
      type: 'subscribe',
      data: options
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptions.add(subscriptionKey);

    console.log('Subscribed to:', options);
  }

  unsubscribe(topic: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'unsubscribe',
      data: { topic }
    };

    this.ws.send(JSON.stringify(message));

    // Remove from subscriptions
    const toRemove = [];
    for (const subscription of this.subscriptions) {
      const parsed = JSON.parse(subscription);
      if (parsed.topic === topic) {
        toRemove.push(subscription);
      }
    }

    toRemove.forEach(sub => this.subscriptions.delete(sub));

    console.log('Unsubscribed from:', topic);
  }

  onMessage(type: string, handler: Function) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  offMessage(type: string, handler: Function) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'ping',
        data: { timestamp: new Date().toISOString() }
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.messageHandlers.clear();
  }
}

// React Hook for WebSocket
export function useCLMSWebSocket(token: string | null) {
  const [ws, setWs] = useState<CLMSWebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    if (token) {
      const websocket = new CLMSWebSocket();

      websocket.connect(token)
        .then(() => {
          setConnected(true);
          setWs(websocket);
        })
        .catch(error => {
          console.error('WebSocket connection failed:', error);
          setConnected(false);
        });

      // Setup message handler
      websocket.onMessage('*', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      return () => {
        websocket.disconnect();
        setConnected(false);
        setWs(null);
      };
    }
  }, [token]);

  const subscribe = useCallback((options: SubscriptionOptions) => {
    if (ws) {
      ws.subscribe(options);
    }
  }, [ws]);

  const unsubscribe = useCallback((topic: string) => {
    if (ws) {
      ws.unsubscribe(topic);
    }
  }, [ws]);

  const onMessage = useCallback((type: string, handler: Function) => {
    if (ws) {
      ws.onMessage(type, handler);
    }
  }, [ws]);

  return {
    connected,
    lastMessage,
    subscribe,
    unsubscribe,
    onMessage
  };
}
```

### Python WebSocket Client
```python
# websocket_client.py
import asyncio
import websockets
import json
import logging
from typing import Dict, Any, Callable, Optional
from datetime import datetime

class CLMSWebSocketClient:
    def __init__(self, url: str = "ws://localhost:3002/ws"):
        self.url = url
        self.token: Optional[str] = None
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.subscriptions: set = set()
        self.message_handlers: Dict[str, Callable] = {}
        self.running = False

        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    async def connect(self, token: str) -> None:
        """Connect to WebSocket server"""
        self.token = token
        headers = {"Authorization": f"Bearer {token}"}

        try:
            self.websocket = await websockets.connect(
                self.url,
                extra_headers=headers
            )
            self.running = True
            self.logger.info("WebSocket connected")

            # Start message listener
            asyncio.create_task(self.listen_for_messages())

        except Exception as e:
            self.logger.error(f"WebSocket connection failed: {e}")
            raise

    async def listen_for_messages(self) -> None:
        """Listen for incoming messages"""
        try:
            async for message in self.websocket:
                await self.handle_message(message)
        except websockets.exceptions.ConnectionClosed:
            self.logger.info("WebSocket connection closed")
            self.running = False
        except Exception as e:
            self.logger.error(f"Error in message listener: {e}")
            self.running = False

    async def handle_message(self, raw_message: str) -> None:
        """Handle incoming WebSocket message"""
        try:
            message = json.loads(raw_message)
            self.logger.debug(f"Received message: {message}")

            # Call specific message handler
            handler = self.message_handlers.get(message.get('type'))
            if handler:
                await handler(message.get('data'))

            # Call general message handler
            general_handler = self.message_handlers.get('*')
            if general_handler:
                await general_handler(message)

        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON message: {e}")
        except Exception as e:
            self.logger.error(f"Error handling message: {e}")

    async def subscribe(self, topic: str, filters: Optional[Dict[str, Any]] = None) -> None:
        """Subscribe to a topic"""
        if not self.websocket:
            raise RuntimeError("WebSocket not connected")

        subscription = {
            "type": "subscribe",
            "data": {
                "topic": topic,
                **({"filters": filters} if filters else {})
            }
        }

        await self.websocket.send(json.dumps(subscription))
        self.subscriptions.add(topic)
        self.logger.info(f"Subscribed to topic: {topic}")

    async def unsubscribe(self, topic: str) -> None:
        """Unsubscribe from a topic"""
        if not self.websocket:
            return

        message = {
            "type": "unsubscribe",
            "data": {"topic": topic}
        }

        await self.websocket.send(json.dumps(message))
        self.subscriptions.discard(topic)
        self.logger.info(f"Unsubscribed from topic: {topic}")

    async def send_ping(self) -> None:
        """Send ping message"""
        if not self.websocket:
            return

        message = {
            "type": "ping",
            "data": {
                "timestamp": datetime.now().isoformat()
            }
        }

        await self.websocket.send(json.dumps(message))

    def on_message(self, message_type: str, handler: Callable) -> None:
        """Register message handler"""
        self.message_handlers[message_type] = handler

    def disconnect(self) -> None:
        """Disconnect from WebSocket"""
        self.running = False
        if self.websocket:
            asyncio.create_task(self.websocket.close())
        self.subscriptions.clear()
        self.message_handlers.clear()

# Usage Example
async def main():
    client = CLMSWebSocketClient()

    # Define message handlers
    async def handle_activity_update(data):
        print(f"Activity update: {data}")

    async def handle_equipment_update(data):
        print(f"Equipment update: {data}")

    async def handle_notification(data):
        print(f"Notification: {data}")

    async def handle_general_message(message):
        print(f"General message: {message['type']}")

    # Register handlers
    client.on_message('activity_update', handle_activity_update)
    client.on_message('equipment_update', handle_equipment_update)
    client.on_message('notification', handle_notification)
    client.on_message('*', handle_general_message)

    try:
        # Connect with auth token
        await client.connect("your-jwt-token-here")

        # Subscribe to topics
        await client.subscribe('activities')
        await client.subscribe('equipment')
        await client.subscribe('notifications')

        # Keep running
        while client.running:
            await asyncio.sleep(1)
            # Send ping every 30 seconds
            # await client.send_ping()

    except KeyboardInterrupt:
        print("Interrupted by user")
    finally:
        client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

## Integration Examples

### Custom Analytics Dashboard
```typescript
// src/components/AnalyticsDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useCLMSApi, usePredictiveInsights, useUsageHeatMap } from '../hooks/useCLMSApi';
import { useCLMSWebSocket } from '../hooks/useCLMSWebSocket';

const AnalyticsDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [selectedMetric, setSelectedMetric] = useState('student_visits');

  // API data
  const { data: insights, loading: insightsLoading } = usePredictiveInsights(timeframe);
  const { data: heatMapData, loading: heatMapLoading } = useUsageHeatMap(timeframe);
  const { data: forecastData, execute: getForecast } = useCLMSApi(
    () => apiClient.getTimeSeriesForecast({ metric: selectedMetric, timeframe, periods: 14 })
  );

  // WebSocket for real-time updates
  const { connected, subscribe, onMessage } = useCLMSWebSocket(localStorage.getItem('authToken'));

  useEffect(() => {
    if (connected) {
      // Subscribe to real-time analytics updates
      subscribe({ topic: 'analytics' });

      // Listen for analytics updates
      onMessage('analytics_update', (data) => {
        console.log('Real-time analytics update:', data);
        // Refresh data when updates arrive
        getForecast();
      });
    }
  }, [connected, subscribe, onMessage, getForecast]);

  useEffect(() => {
    // Get forecast when metric or timeframe changes
    getForecast();
  }, [selectedMetric, timeframe, getForecast]);

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h2>Library Analytics Dashboard</h2>

        <div className="controls">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            <option value="student_visits">Student Visits</option>
            <option value="equipment_usage">Equipment Usage</option>
            <option value="book_circulation">Book Circulation</option>
          </select>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Connection Status */}
        <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>

        {/* Predictive Insights */}
        <section className="insights-section">
          <h3>Predictive Insights</h3>
          {insightsLoading ? (
            <div>Loading insights...</div>
          ) : (
            <div className="insights-grid">
              {insights?.data?.map((insight) => (
                <div key={insight.id} className={`insight-card impact-${insight.impact}`}>
                  <h4>{insight.title}</h4>
                  <p>{insight.description}</p>
                  <div className="confidence">
                    Confidence: {insight.confidence}%
                  </div>
                  <ul className="recommendations">
                    {insight.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Usage Heat Map */}
        <section className="heatmap-section">
          <h3>Usage Heat Map</h3>
          {heatMapLoading ? (
            <div>Loading heat map...</div>
          ) : (
            <HeatMapComponent data={heatMapData?.data || []} />
          )}
        </section>

        {/* Time Series Forecast */}
        <section className="forecast-section">
          <h3>Usage Forecast</h3>
          {forecastData ? (
            <ForecastChart data={forecastData.data} metric={selectedMetric} />
          ) : (
            <div>Loading forecast...</div>
          )}
        </section>
      </div>
    </div>
  );
};

// Heat Map Component
const HeatMapComponent: React.FC<{ data: any[] }> = ({ data }) => {
  // Create heat map grid (24 hours x 7 days)
  const grid = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const intensity = data.find(d => d.dayOfWeek === day && d.hour === hour)?.intensity || 0;
      return { day, hour, intensity };
    })
  );

  const maxIntensity = Math.max(...data.map(d => d.intensity), 1);

  return (
    <div className="heatmap-grid">
      <div className="heatmap-legend">
        <span>Low</span>
        <div className="gradient-bar"></div>
        <span>High</span>
      </div>
      <div className="heatmap-content">
        {grid.map((row, dayIndex) => (
          <div key={dayIndex} className="heatmap-row">
            {row.map((cell, hourIndex) => (
              <div
                key={`${dayIndex}-${hourIndex}`}
                className="heatmap-cell"
                style={{
                  backgroundColor: `rgba(59, 130, 246, ${cell.intensity / maxIntensity})`
                }}
                title={`${dayIndex === 0 ? 'Sun' : dayIndex === 1 ? 'Mon' : dayIndex === 2 ? 'Tue' : dayIndex === 3 ? 'Wed' : dayIndex === 4 ? 'Thu' : dayIndex === 5 ? 'Fri' : 'Sat'} ${hourIndex}:00 - ${cell.intensity} activities`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Forecast Chart Component
const ForecastChart: React.FC<{ data: any[], metric: string }> = ({ data, metric }) => {
  // Simple line chart implementation
  const historicalData = data.filter(d => d.value > 0);
  const forecastData = data.filter(d => d.predicted !== undefined);

  return (
    <div className="forecast-chart">
      <svg width="800" height="400" className="chart-svg">
        {/* Chart implementation would go here */}
        <text x="400" y="200" textAnchor="middle">
          Forecast chart for {metric}
        </text>
      </svg>
    </div>
  );
};

export default AnalyticsDashboard;
```

### Self-Service Kiosk Integration
```typescript
// src/components/SelfServiceKiosk.tsx
import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../lib/api';

const SelfServiceKiosk: React.FC = () => {
  const [studentStatus, setStudentStatus] = useState<any>(null);
  const [lastScan, setLastScan] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Play sound effect
  const playSound = (type: 'success' | 'error' | 'warning') => {
    if (!soundEnabled) return;

    const audio = new Audio();
    switch (type) {
      case 'success':
        audio.src = '/sounds/success.mp3';
        break;
      case 'error':
        audio.src = '/sounds/error.mp3';
        break;
      case 'warning':
        audio.src = '/sounds/warning.mp3';
        break;
    }
    audio.play().catch(e => console.log('Could not play sound:', e));
  };

  // Handle barcode scan
  const handleScan = async (barcode: string) => {
    if (processing || !barcode) return;

    setProcessing(true);
    setMessage('Processing...');

    try {
      // Call self-service API
      const result = await apiClient.scanStudent(barcode, 'Main Library');

      if (result.success) {
        setStudentStatus(result.data);
        setMessage(result.data.message);
        playSound('success');

        // Clear status after 3 seconds
        setTimeout(() => {
          setStudentStatus(null);
          setMessage('');
        }, 3000);
      } else {
        setMessage('Scan failed. Please try again.');
        playSound('error');
      }
    } catch (error) {
      console.error('Scan error:', error);
      setMessage('System error. Please contact staff.');
      playSound('error');
    } finally {
      setProcessing(false);
      setLastScan(barcode);
    }
  };

  // Handle keyboard input for barcode scanner
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Most barcode scanners end with a newline character
    if (value.includes('\n') || value.includes('\r')) {
      const barcode = value.replace(/[\n\r]/g, '');
      handleScan(barcode);
      e.target.value = '';
    }
  };

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Auto-clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="self-service-kiosk">
      <div className="kiosk-header">
        <h1>Library Self-Service</h1>
        <div className="sound-toggle">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`sound-button ${soundEnabled ? 'enabled' : 'disabled'}`}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>

      <div className="scan-area">
        <div className="scan-instructions">
          <h2>Scan Your ID Card</h2>
          <p>Place your student ID under the scanner</p>
        </div>

        {/* Hidden input for barcode scanner */}
        <input
          ref={inputRef}
          type="text"
          className="barcode-input"
          onChange={handleInputChange}
          autoFocus
        />

        {/* Processing indicator */}
        {processing && (
          <div className="processing">
            <div className="spinner"></div>
            <p>Processing scan...</p>
          </div>
        )}

        {/* Student status display */}
        {studentStatus && (
          <div className="student-status">
            <div className="student-info">
              <h3>{studentStatus.welcomeMessage}</h3>
              <div className="student-details">
                <p><strong>Name:</strong> {studentStatus.student?.firstName} {studentStatus.student?.lastName}</p>
                <p><strong>Grade:</strong> {studentStatus.student?.gradeLevel}</p>
                <p><strong>Action:</strong> {studentStatus.action}</p>
                <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Message display */}
        {message && (
          <div className={`message ${message.includes('failed') || message.includes('error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {/* Manual entry fallback */}
        <div className="manual-entry">
          <p>Having trouble scanning?</p>
          <input
            type="text"
            placeholder="Enter your Student ID"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleScan((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
      </div>

      <div className="kiosk-footer">
        <p>Need help? Ask library staff for assistance</p>
        <p>Library Hours: 8:00 AM - 5:00 PM</p>
      </div>
    </div>
  );
};

export default SelfServiceKiosk;
```

## Testing Examples

### API Integration Tests
```typescript
// tests/api.integration.test.ts
import { CLMSApiClient } from '../src/lib/api';

describe('CLMS API Integration', () => {
  let client: CLMSApiClient;
  let authToken: string;

  beforeAll(async () => {
    client = new CLMSApiClient('http://localhost:3001/api');

    // Login and get token
    const authResult = await client.login({
      username: 'test_admin',
      password: 'test_password'
    });

    expect(authResult.success).toBe(true);
    authToken = authResult.data.token;
  });

  describe('Student Management', () => {
    let studentId: string;

    test('should create a new student', async () => {
      const studentData = {
        studentId: `TEST${Date.now()}`,
        firstName: 'Test',
        lastName: 'Student',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      };

      const result = await client.createStudent(studentData);

      expect(result.success).toBe(true);
      expect(result.data.studentId).toBe(studentData.studentId);
      studentId = result.data.id;
    });

    test('should retrieve student list', async () => {
      const result = await client.getStudents({
        page: 1,
        limit: 10,
        isActive: true
      });

      expect(result.success).toBe(true);
      expect(result.data.students).toBeInstanceOf(Array);
      expect(result.data.pagination).toBeDefined();
    });

    test('should retrieve specific student', async () => {
      const result = await client.getStudent(studentId);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(studentId);
    });

    test('should update student information', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Student'
      };

      const result = await client.updateStudent(studentId, updateData);

      expect(result.success).toBe(true);
      expect(result.data.firstName).toBe(updateData.firstName);
    });
  });

  describe('Analytics', () => {
    test('should generate predictive insights', async () => {
      const result = await client.getPredictiveInsights({
        timeframe: 'week',
        confidence: 70
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);

      if (result.data.length > 0) {
        const insight = result.data[0];
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('title');
        expect(insight).toHaveProperty('confidence');
        expect(insight).toHaveProperty('recommendations');
      }
    });

    test('should generate usage heat map', async () => {
      const result = await client.getUsageHeatMap({
        timeframe: 'week'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);

      if (result.data.length > 0) {
        const dataPoint = result.data[0];
        expect(dataPoint).toHaveProperty('hour');
        expect(dataPoint).toHaveProperty('dayOfWeek');
        expect(dataPoint).toHaveProperty('intensity');
      }
    });

    test('should generate time series forecast', async () => {
      const result = await client.getTimeSeriesForecast({
        metric: 'student_visits',
        timeframe: 'week',
        periods: 7
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);

      if (result.data.length > 0) {
        const dataPoint = result.data[0];
        expect(dataPoint).toHaveProperty('timestamp');
        expect(dataPoint).toHaveProperty('value');
      }
    });
  });

  describe('Self-Service', () => {
    test('should handle student scan', async () => {
      // This test requires a valid student barcode
      const testBarcode = 'TEST123456';

      try {
        const result = await client.scanStudent(testBarcode, 'Test Location');

        if (result.success) {
          expect(result.data).toHaveProperty('student');
          expect(result.data).toHaveProperty('action');
          expect(result.data).toHaveProperty('message');
        }
      } catch (error) {
        // Expected if test barcode doesn't exist
        expect(error.response.status).toBe(404);
      }
    });
  });

  afterAll(async () => {
    // Logout
    await client.logout();
  });
});
```

### WebSocket Tests
```typescript
// tests/websocket.test.ts
import { CLMSWebSocket } from '../src/lib/websocket';

describe('CLMS WebSocket', () => {
  let ws: CLMSWebSocket;
  const testToken = 'test-jwt-token';

  beforeAll(() => {
    ws = new CLMSWebSocket('ws://localhost:3002/ws');
  });

  afterAll(() => {
    ws.disconnect();
  });

  test('should connect to WebSocket server', async () => {
    await expect(ws.connect(testToken)).resolves.not.toThrow();
  }, 10000);

  test('should subscribe to topics', () => {
    expect(() => {
      ws.subscribe({ topic: 'activities' });
      ws.subscribe({
        topic: 'equipment',
        filters: { type: 'computer' }
      });
    }).not.toThrow();
  });

  test('should handle messages', (done) => {
    ws.onMessage('test_message', (data) => {
      expect(data).toHaveProperty('test');
      done();
    });

    // Simulate receiving a message
    ws['handleMessage'](JSON.stringify({
      id: 'test',
      timestamp: new Date().toISOString(),
      type: 'test_message',
      data: { test: true }
    }));
  });

  test('should unsubscribe from topics', () => {
    expect(() => {
      ws.unsubscribe('activities');
    }).not.toThrow();
  });

  test('should send ping messages', () => {
    expect(() => {
      ws.sendPing();
    }).not.toThrow();
  });
});
```

## Deployment Examples

### Docker Configuration
```dockerfile
# Dockerfile.backend
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY Backend/package*.json ./
COPY Backend/prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY Backend/ .

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S clms -u 1001

# Change ownership
RUN chown -R clms:nodejs /app
USER clms

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "start"]
```

```dockerfile
# Dockerfile.frontend
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY Frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY Frontend/ .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY Frontend/nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  # MySQL Database
  mysql:
    image: mysql:8.0
    container_name: clms_mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: clms_database
      MYSQL_USER: clms_user
      MYSQL_PASSWORD: clms_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/init:/docker-entrypoint-initdb.d
    ports:
      - "3306:3306"
    networks:
      - clms_network
    restart: unless-stopped

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: clms_redis
    command: redis-server --requirepass redispassword
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - clms_network
    restart: unless-stopped

  # Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: clms_backend
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://clms_user:clms_password@mysql:3306/clms_database
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redispassword
      JWT_SECRET: your-super-secret-jwt-key
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      - mysql
      - redis
    networks:
      - clms_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: clms_frontend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - clms_network
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:

networks:
  clms_network:
    driver: bridge
```

## Environment Setup Scripts

### Development Setup Script
```bash
#!/bin/bash
# setup-dev.sh

echo "🚀 Setting up CLMS Development Environment"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Clone repository (if not already cloned)
if [ ! -d "clms" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/your-org/clms.git
    cd clms
else
    echo "📁 Repository already exists, updating..."
    cd clms
    git pull origin main
fi

# Install dependencies
echo "📦 Installing dependencies..."

echo "Installing backend dependencies..."
cd Backend
npm install

echo "Installing frontend dependencies..."
cd ../Frontend
npm install

# Setup environment files
echo "⚙️ Setting up environment..."

cd ../Backend
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "📝 Created Backend .env file. Please update with your configuration."
fi

cd ../Frontend
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "📝 Created Frontend .env file. Please update with your configuration."
fi

# Setup database
echo "🗄️ Setting up database..."

cd ../Backend
echo "Please ensure MySQL is running and update .env with database credentials."
echo "Then run: npx prisma db push"
echo "And optionally: npx prisma db seed"

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Update Backend/.env with your database configuration"
echo "2. Update Frontend/.env with your API URL"
echo "3. Run 'cd Backend && npx prisma db push' to setup database"
echo "4. Run 'npm run dev' to start development servers"
echo ""
echo "🌐 Access your application at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   API Docs: http://localhost:3001/docs"
```

### Production Deployment Script
```bash
#!/bin/bash
# deploy-production.sh

set -e

echo "🚀 Deploying CLMS to Production"

# Configuration
SERVER_USER="deploy"
SERVER_IP="your-server-ip"
REMOTE_PATH="/opt/clms"
BACKUP_PATH="/opt/clms/backups"

# Create backup
echo "💾 Creating backup..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && ./scripts/backup-application.sh"

# Pull latest code
echo "📥 Pulling latest code..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && git pull origin main"

# Install dependencies
echo "📦 Installing dependencies..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH/Backend && npm ci --production"
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH/Frontend && npm ci --production && npm run build"

# Run database migrations
echo "🗄️ Running database migrations..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH/Backend && npx prisma db push"

# Restart services
echo "🔄 Restarting services..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && pm2 restart clms-backend"

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Health check
echo "🏥 Performing health check..."
if curl -f http://$SERVER_IP:3001/health > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Application is available at: http://$SERVER_IP"
```

## Enhanced Import System Development

### Working with the Flexible Import System

The new flexible import system provides powerful data import capabilities with automatic field mapping, validation, and progress tracking.

### Import Client Implementation

```typescript
// Enhanced import client with progress tracking
import { ImportClient } from './lib/import-client';

class EnhancedImportClient {
  private client: ImportClient;

  constructor(baseURL: string) {
    this.client = new ImportClient(baseURL);
  }

  // Validate import data before processing
  async validateImport<T>(
    entityType: string,
    data: any[],
    options: {
      fieldMapping?: Record<string, string>;
      strictValidation?: boolean;
    } = {}
  ) {
    return await this.client.validateImport(entityType, data, options);
  }

  // Execute import with real-time progress tracking
  async executeImport<T>(
    entityType: string,
    data: any[],
    options: {
      skipDuplicates?: boolean;
      updateExisting?: boolean;
      fieldMapping?: Record<string, string>;
      batchSize?: number;
      onProgress?: (progress: ImportProgress) => void;
    } = {}
  ) {
    return await this.client.executeImport(entityType, data, options);
  }

  // Monitor import status
  async getImportStatus(importId: string) {
    return await this.client.getImportStatus(importId);
  }

  // Rollback failed import
  async rollbackImport(importId: string, reason: string) {
    return await this.client.rollbackImport(importId, reason);
  }
}
```

### Import Progress Tracking

```typescript
// Import progress interface
interface ImportProgress {
  importId: string;
  status: 'validating' | 'processing' | 'completed' | 'failed' | 'rolling_back';
  progress: number; // 0-100
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  errors: ImportError[];
  startTime: string;
  estimatedCompletion?: string;
}

// Progress tracking hook for React
function useImportProgress(importId: string | null) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const importClient = new EnhancedImportClient('/api');

  useEffect(() => {
    if (!importId) return;

    setLoading(true);
    const interval = setInterval(async () => {
      try {
        const status = await importClient.getImportStatus(importId);
        setProgress(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching import status:', error);
        clearInterval(interval);
        setLoading(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [importId]);

  return { progress, loading };
}
```

### Import UI Component

```typescript
// Import component with progress tracking
import React, { useState } from 'react';
import { useImportProgress } from './hooks/useImportProgress';
import { EnhancedImportClient } from './lib/import-client';

const DataImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: false,
    fieldMapping: {}
  });
  
  const { progress, loading } = useImportProgress(importId);
  const importClient = new EnhancedImportClient('/api');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      // Parse file data
      const fileContent = await file.text();
      const data = parseCSV(fileContent);
      
      // Validate first
      const validation = await importClient.validateImport('students', data, importOptions);
      if (!validation.isValid) {
        alert(`Validation failed: ${validation.errors.length} errors`);
        return;
      }

      // Start import
      const result = await importClient.executeImport('students', data, {
        ...importOptions,
        onProgress: (progress) => {
          console.log(`Import progress: ${progress.progress}%`);
        }
      });

      if (result.importId) {
        setImportId(result.importId);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please try again.');
    }
  };

  return (
    <div className="import-container">
      <h2>Import Students</h2>
      
      <div className="import-form">
        <input type="file" accept=".csv,.xlsx,.json" onChange={handleFileSelect} />
        
        <div className="import-options">
          <label>
            <input
              type="checkbox"
              checked={importOptions.skipDuplicates}
              onChange={(e) => setImportOptions({
                ...importOptions,
                skipDuplicates: e.target.checked
              })}
            />
            Skip duplicate records
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={importOptions.updateExisting}
              onChange={(e) => setImportOptions({
                ...importOptions,
                updateExisting: e.target.checked
              })}
            />
            Update existing records
          </label>
        </div>
        
        <button onClick={handleImport} disabled={!file || loading}>
          Import Data
        </button>
      </div>

      {progress && (
        <div className="import-progress">
          <h3>Import Progress</h3>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <p>
            Status: {progress.status}<br />
            Progress: {progress.processedRecords} / {progress.totalRecords}<br />
            Failed: {progress.failedRecords}
          </p>
          
          {progress.errors.length > 0 && (
            <div className="import-errors">
              <h4>Errors:</h4>
              <ul>
                {progress.errors.slice(0, 10).map((error, index) => (
                  <li key={index}>
                    Row {error.row}: {error.message}
                  </li>
                ))}
                {progress.errors.length > 10 && (
                  <li>... and {progress.errors.length - 10} more errors</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Field Mapping Configuration

```typescript
// Field mapping configuration component
const FieldMappingConfig: React.FC<{
  entityType: string;
  mapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
}> = ({ entityType, mapping, onChange }) => {
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [sourceFields, setSourceFields] = useState<string[]>([]);

  useEffect(() => {
    // Load available fields for entity type
    const loadFields = async () => {
      try {
        const response = await fetch(`/api/import/fields/${entityType}`);
        const data = await response.json();
        setAvailableFields(data.fields);
      } catch (error) {
        console.error('Error loading fields:', error);
      }
    };

    loadFields();
  }, [entityType]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Parse first few rows to detect source fields
      const fileContent = await file.text();
      const rows = fileContent.split('\n').slice(0, 5);
      const headers = rows[0].split(',');
      
      setSourceFields(headers);
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  };

  const handleMappingChange = (sourceField: string, targetField: string) => {
    onChange({
      ...mapping,
      [sourceField]: targetField
    });
  };

  return (
    <div className="field-mapping-config">
      <h3>Field Mapping Configuration</h3>
      
      <div className="mapping-source">
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileSelect}
        />
        {sourceFields.length > 0 && (
          <div className="source-fields">
            <h4>Source Fields:</h4>
            <ul>
              {sourceFields.map((field, index) => (
                <li key={index}>{field}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {sourceFields.length > 0 && (
        <div className="mapping-target">
          <h4>Target Fields:</h4>
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Source Field</th>
                <th>Target Field</th>
              </tr>
            </thead>
            <tbody>
              {sourceFields.map((sourceField) => (
                <tr key={sourceField}>
                  <td>{sourceField}</td>
                  <td>
                    <select
                      value={mapping[sourceField] || ''}
                      onChange={(e) => handleMappingChange(sourceField, e.target.value)}
                    >
                      <option value="">-- Select Field --</option>
                      {availableFields.map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
```

### Testing Import Functionality

```typescript
// Import testing utilities
import { ImportClient } from './lib/import-client';

class ImportTester {
  private client: ImportClient;
  private testResults: TestResult[] = [];

  constructor(baseURL: string) {
    this.client = new ImportClient(baseURL);
  }

  // Test validation with invalid data
  async testValidation() {
    const invalidData = [
      { invalidField: 'value' },
      { studentId: '123' } // Missing required fields
    ];

    const result = await this.client.validateImport('students', invalidData);
    
    this.addTestResult('Validation Test', !result.isValid, 'Should fail validation');
    
    return result;
  }

  // Test import with valid data
  async testImport() {
    const validData = [
      {
        studentId: 'TEST001',
        firstName: 'Test',
        lastName: 'Student',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      }
    ];

    const result = await this.client.executeImport('students', validData);
    
    this.addTestResult('Import Test', result.success, 'Should import successfully');
    
    return result;
  }

  // Test duplicate handling
  async testDuplicateHandling() {
    const duplicateData = [
      {
        studentId: 'TEST001', // Same ID as previous test
        firstName: 'Test',
        lastName: 'Student',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      }
    ];

    const result = await this.client.executeImport('students', duplicateData, {
      skipDuplicates: true
    });
    
    this.addTestResult('Duplicate Test', result.duplicatesSkipped > 0, 'Should skip duplicates');
    
    return result;
  }

  // Test rollback functionality
  async testRollback(importId: string) {
    const result = await this.client.rollbackImport(importId, 'Test rollback');
    
    this.addTestResult('Rollback Test', result.success, 'Should rollback successfully');
    
    return result;
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 Running Import System Tests...');
    
    await this.testValidation();
    const importResult = await this.testImport();
    
    if (importResult.importId) {
      await this.testDuplicateHandling();
      await this.testRollback(importResult.importId);
    }
    
    this.printResults();
    return this.testResults;
  }

  private addTestResult(name: string, passed: boolean, description: string) {
    this.testResults.push({
      name,
      passed,
      description,
      timestamp: new Date().toISOString()
    });
  }

  private printResults() {
    console.log('\n📊 Test Results:');
    console.log('================');
    
    this.testResults.forEach((result) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.description}`);
    });
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`\nSummary: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
  }
}

interface TestResult {
  name: string;
  passed: boolean;
  description: string;
  timestamp: string;
}

// Usage
const tester = new ImportTester('http://localhost:3001/api');
tester.runAllTests().then(results => {
  console.log('Test completed:', results);
});
```

This comprehensive Developer Quick Start Guide provides everything developers need to integrate with and extend the CLMS system, including API clients, WebSocket integration, testing examples, and deployment configurations.