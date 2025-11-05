import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { apiClient } from './api';

// Types for offline queue
interface QueueItem {
  id: string;
  type: 'api-call' | 'activity-log' | 'session-action';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

// IndexedDB setup
class OfflineQueue {
  private db: IDBPDatabase | null = null;
  private dbName = 'clms-offline-db';
  private dbVersion = 1;
  private isProcessing = false;

  // Initialize IndexedDB
  async init() {
    if (this.db) {
      return this.db;
    }

    this.db = await openDB(this.dbName, this.dbVersion, {
      upgrade(db) {
        // Create queue store
        const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp');
        queueStore.createIndex('type', 'type');

        // Create activities store for local caching
        const activitiesStore = db.createObjectStore('activities', {
          keyPath: 'id',
        });
        activitiesStore.createIndex('timestamp', 'timestamp');
        activitiesStore.createIndex('studentId', 'studentId');

        // Create equipment store for local caching
        const equipmentStore = db.createObjectStore('equipment', {
          keyPath: 'id',
        });
        equipmentStore.createIndex('status', 'status');
        equipmentStore.createIndex('type', 'type');

        // Create students store for local caching
        const studentsStore = db.createObjectStore('students', {
          keyPath: 'id',
        });
        studentsStore.createIndex('gradeLevel', 'gradeLevel');
        studentsStore.createIndex('barcode', 'barcode');
      },
    });

    return this.db;
  }

  // Add item to queue
  async addToQueue(
    item: Omit<QueueItem, 'id' | 'timestamp' | 'retries' | 'maxRetries'>
  ) {
    const db = await this.init();
    const queueItem: QueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    await db.add('queue', queueItem);
    this.processQueue();

    return queueItem.id;
  }

  // Get all queue items
  async getQueueItems(): Promise<QueueItem[]> {
    const db = await this.init();
    return db.getAll('queue');
  }

  // Get queue item by ID
  async getQueueItem(id: string): Promise<QueueItem | undefined> {
    const db = await this.init();
    return db.get('queue', id);
  }

  // Remove queue item
  async removeQueueItem(id: string) {
    const db = await this.init();
    await db.delete('queue', id);
  }

  // Update queue item
  async updateQueueItem(item: QueueItem) {
    const db = await this.init();
    await db.put('queue', item);
  }

  // Process queue when online
  async processQueue() {
    if (this.isProcessing || !navigator.onLine) {
      return;
    }

    this.isProcessing = true;

    try {
      const items = await this.getQueueItems();

      for (const item of items) {
        try {
          await this.processQueueItem(item);
          await this.removeQueueItem(item.id);
        } catch (error) {
          console.error('Failed to process queue item:', error);

          // Update retry count
          item.retries++;
          if (item.retries >= item.maxRetries) {
            // Max retries reached, remove from queue
            await this.removeQueueItem(item.id);
            console.error('Max retries reached for queue item:', item.id);
          } else {
            // Update item with increased retry count
            await this.updateQueueItem(item);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Process individual queue item
  private async processQueueItem(item: QueueItem) {
    if (item.type === 'api-call' && item.endpoint && item.method) {
      switch (item.method.toLowerCase()) {
        case 'get':
          return await apiClient.get(item.endpoint);
        case 'post':
          return await apiClient.post(item.endpoint, item.data);
        case 'put':
          return await apiClient.put(item.endpoint, item.data);
        case 'delete':
          return await apiClient.delete(item.endpoint);
        default:
          throw new Error(`Unknown method: ${item.method}`);
      }
    } else if (item.type === 'activity-log') {
      const response = await apiClient.post(
        '/api/students/activity',
        item.data
      );
      return response;
    } else if (item.type === 'session-action' && item.endpoint) {
      const response = await apiClient.post(item.endpoint, item.data);
      return response;
    }

    throw new Error(`Unknown queue item type: ${item.type}`);
  }

  // Cache data locally
  async cacheData(store: string, data: any) {
    const db = await this.init();

    if (Array.isArray(data)) {
      for (const item of data) {
        await db.put(store, { ...item, _cached: true, _cacheTime: Date.now() });
      }
    } else {
      await db.put(store, { ...data, _cached: true, _cacheTime: Date.now() });
    }
  }

  // Get cached data
  async getCachedData(
    store: string,
    maxAge: number = 5 * 60 * 1000
  ): Promise<any[]> {
    const db = await this.init();
    const allData = await db.getAll(store);
    const now = Date.now();

    return allData.filter(
      (item) => item._cached && now - item._cacheTime < maxAge
    );
  }

  // Clear old cache
  async clearOldCache(store: string, maxAge: number = 30 * 60 * 1000) {
    const db = await this.init();
    const allData = await db.getAll(store);
    const now = Date.now();

    for (const item of allData) {
      if (item._cached && now - item._cacheTime > maxAge) {
        await db.delete(store, item.id);
      }
    }
  }

  // Get queue size
  async getQueueSize(): Promise<number> {
    const db = await this.init();
    return db.count('queue');
  }

  // Clear queue
  async clearQueue() {
    const db = await this.init();
    await db.clear('queue');
  }
}

// Create singleton instance
export const offlineQueue = new OfflineQueue();

// Initialize offline queue and set up event listeners
export const initializeOfflineQueue = () => {
  // Initialize the queue
  offlineQueue.init();

  // Listen for online/offline events
  window.addEventListener('online', () => {
    // App is online, processing queue...
    offlineQueue.processQueue();
  });

  window.addEventListener('offline', () => {
    // App is offline, queueing actions...
  });

  // Process queue on app start if online
  if (navigator.onLine) {
    offlineQueue.processQueue();
  }
};

// Helper functions for common offline operations
export const offlineActions = {
  // Log activity when offline
  logActivity: (activityData: any) => {
    return offlineQueue.addToQueue({
      type: 'activity-log',
      data: activityData,
    });
  },

  // Start equipment session when offline
  startSession: (
    equipmentId: string,
    studentId: string,
    timeLimitMinutes: number
  ) => {
    return offlineQueue.addToQueue({
      type: 'session-action',
      endpoint: '/api/equipment/session',
      data: { equipmentId, studentId, timeLimitMinutes },
    });
  },

  // End equipment session when offline
  endSession: (sessionId: string) => {
    return offlineQueue.addToQueue({
      type: 'session-action',
      endpoint: `/api/equipment/session/${sessionId}/end`,
      data: {},
    });
  },

  // Generic API call when offline
  apiCall: (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any
  ) => {
    return offlineQueue.addToQueue({
      type: 'api-call',
      endpoint,
      method,
      data,
    });
  },
};

export default offlineQueue;
