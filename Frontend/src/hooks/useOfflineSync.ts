import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

// Types for offline storage
interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// IndexedDB setup
const DB_NAME = 'clms-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'sync-queue';

class OfflineSyncService {
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private isOnline = navigator.onLine;

  constructor() {
    this.initializeDB();
    this.setupEventListeners();
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineSync] Failed to open database');
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.debug('[OfflineSync] Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('endpoint', 'endpoint', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.debug('[OfflineSync] Online - attempting to sync');
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.debug('[OfflineSync] Offline - queuing actions');
    });

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_REQUEST') {
          this.syncWhenOnline();
        }
      });
    }
  }

  // Queue an action for offline sync
  async queueAction(
    action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    const offlineAction: OfflineAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.add(offlineAction);

      console.debug(
        '[OfflineSync] Action queued:',
        offlineAction.type,
        offlineAction.endpoint
      );

      // Show notification for queued action
      if (!this.isOnline) {
        toast.info("Action saved for when you're back online");
      }

      // Update app store with queue count
      await this.updateQueueCount();
    } catch (error) {
      console.error('[OfflineSync] Failed to queue action:', error);
      toast.error('Failed to save action for offline sync');
    }
  }

  // Get all queued actions
  async getQueuedActions(): Promise<OfflineAction[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const actions: OfflineAction[] = [];

      return new Promise((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            actions.push(cursor.value);
            cursor.continue();
          } else {
            // Sort by timestamp
            resolve(actions.sort((a, b) => a.timestamp - b.timestamp));
          }
        };

        request.onerror = () =>
          reject(new Error('Failed to fetch queued actions'));
      });
    } catch (error) {
      console.error('[OfflineSync] Failed to get queued actions:', error);
      return [];
    }
  }

  // Sync when online
  async syncWhenOnline(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    console.debug('[OfflineSync] Starting sync process');

    try {
      const actions = await this.getQueuedActions();

      if (actions.length === 0) {
        console.debug('[OfflineSync] No actions to sync');
        return;
      }

      toast.info(
        `Syncing ${actions.length} action${actions.length > 1 ? 's' : ''}...`
      );

      const results = await Promise.allSettled(
        actions.map((action) => this.processAction(action))
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      // Remove successfully synced actions
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const action = actions[i];
        if (result?.status === 'fulfilled' && action) {
          await this.removeAction(action.id);
        }
      }

      // Update queue count
      await this.updateQueueCount();

      if (successful > 0) {
        toast.success(
          `Synced ${successful} action${successful > 1 ? 's' : ''}`
        );
      }

      if (failed > 0) {
        toast.error(`${failed} action${failed > 1 ? 's' : ''} failed to sync`);
      }

      console.debug(
        `[OfflineSync] Sync completed: ${successful} successful, ${failed} failed`
      );
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error);
      toast.error('Failed to sync offline actions');
    } finally {
      this.syncInProgress = false;
    }
  }

  // Process individual action
  private async processAction(action: OfflineAction): Promise<void> {
    const { endpoint, type, data, retryCount, maxRetries } = action;

    try {
      const options: RequestInit = {
        method:
          type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers if available
          ...(localStorage.getItem('token') && {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          }),
        },
        ...(type !== 'delete' && { body: JSON.stringify(data) }),
      };

      const response = await fetch(endpoint, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.debug('[OfflineSync] Action synced successfully:', action.id);
    } catch (error) {
      console.error('[OfflineSync] Action sync failed:', action.id, error);

      // Update retry count
      if (retryCount < maxRetries) {
        await this.updateActionRetry(action.id, retryCount + 1);
        console.debug(
          `[OfflineSync] Action ${action.id} will be retried (${retryCount + 1}/${maxRetries})`
        );
        throw error; // Will be retried
      } else {
        // Max retries reached, remove action
        await this.removeAction(action.id);
        console.error(
          `[OfflineSync] Action ${action.id} failed after ${maxRetries} retries`
        );
        toast.error('Action failed to sync and was removed');
      }
    }
  }

  // Remove action from queue
  private async removeAction(id: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.delete(id);
    } catch (error) {
      console.error('[OfflineSync] Failed to remove action:', error);
    }
  }

  // Update action retry count
  private async updateActionRetry(
    id: string,
    retryCount: number
  ): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(id);
      request.onsuccess = () => {
        const action = request.result as OfflineAction | undefined;
        if (action) {
          action.retryCount = retryCount;
          store.put(action);
        }
      };
    } catch (error) {
      console.error('[OfflineSync] Failed to update action retry:', error);
    }
  }

  // Get queue count for UI
  private async updateQueueCount(): Promise<void> {
    const actions = await this.getQueuedActions();
    useAppStore.getState().setOfflineQueueCount(actions.length);
  }

  // Clear all queued actions
  async clearQueue(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.clear();

      await this.updateQueueCount();
      console.debug('[OfflineSync] Queue cleared');
      toast.success('Offline queue cleared');
    } catch (error) {
      console.error('[OfflineSync] Failed to clear queue:', error);
      toast.error('Failed to clear offline queue');
    }
  }

  // Get sync status
  getSyncStatus(): {
    isOnline: boolean;
    queueCount: number;
    lastSync: number | null;
  } {
    return {
      isOnline: this.isOnline,
      queueCount: useAppStore.getState().offlineQueueCount,
      lastSync: useAppStore.getState().lastSyncTime,
    };
  }
}

// React hook for offline sync
export const useOfflineSync = () => {
  const [syncService] = useState(() => new OfflineSyncService());
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<number | null>(null);

  // Update sync status
  const updateSyncStatus = useCallback(() => {
    const status = syncService.getSyncStatus();
    setQueueCount(status.queueCount);
    setIsOnline(status.isOnline);
    setLastSync(status.lastSync);
  }, [syncService]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      updateSyncStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateSyncStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial update
    updateSyncStatus();

    // Periodic update
    const interval = setInterval(updateSyncStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [updateSyncStatus]);

  // Queue actions
  const queueAction = useCallback(
    async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => {
      await syncService.queueAction(action);
      updateSyncStatus();
    },
    [syncService, updateSyncStatus]
  );

  // Manual sync
  const syncNow = useCallback(async () => {
    if (isOnline) {
      await syncService.syncWhenOnline();
      setLastSync(Date.now());
      updateSyncStatus();
    } else {
      toast.error('Cannot sync while offline');
    }
  }, [syncService, isOnline, updateSyncStatus]);

  // Clear queue
  const clearQueue = useCallback(async () => {
    await syncService.clearQueue();
    updateSyncStatus();
  }, [syncService, updateSyncStatus]);

  return {
    // State
    isOnline,
    queueCount,
    lastSync,

    // Actions
    queueAction,
    syncNow,
    clearQueue,

    // Utilities
    updateSyncStatus,
  };
};

// Utility functions for common offline operations
export const offlineAPI = {
  // Queue API calls
  queueCreate: (endpoint: string, data: unknown, maxRetries = 3) => ({
    type: 'create' as const,
    endpoint,
    data,
    maxRetries,
  }),

  queueUpdate: (endpoint: string, data: unknown, maxRetries = 3) => ({
    type: 'update' as const,
    endpoint,
    data,
    maxRetries,
  }),

  queueDelete: (endpoint: string, data: unknown, maxRetries = 3) => ({
    type: 'delete' as const,
    endpoint,
    data,
    maxRetries,
  }),

  // Check if request should be cached
  shouldCache: (url: string): boolean => {
    const cacheablePatterns = [
      /\/api\/students/,
      /\/api\/books/,
      /\/api\/equipment/,
      /\/api\/activities/,
      /\/api\/analytics/,
    ];

    return cacheablePatterns.some((pattern) => pattern.test(url));
  },

  // Check if request should be queued for offline
  shouldQueue: (method: string, url: string): boolean => {
    const queueableMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const queueablePatterns = [
      /\/api\/students/,
      /\/api\/books/,
      /\/api\/equipment/,
      /\/api\/activities/,
    ];

    return (
      queueableMethods.includes(method.toUpperCase()) &&
      queueablePatterns.some((pattern) => pattern.test(url))
    );
  },
};

export default OfflineSyncService;
