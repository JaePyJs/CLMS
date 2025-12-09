import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { utilitiesApi } from '@/lib/api';
import { toast } from 'sonner';

// WebSocket context interface for Context7
interface WebSocketContext {
  subscribe: (channel: string) => void;
  onMessage?: (message: { type?: string; data?: unknown }) => void;
}

export interface DocumentationUpdate {
  id: string;
  type:
    | 'content_change'
    | 'structure_change'
    | 'metadata_update'
    | 'version_update';
  timestamp: string;
  source: string;
  changes: {
    file: string;
    section?: string;
    oldContent?: string;
    newContent?: string;
    changeType: 'added' | 'modified' | 'deleted' | 'moved';
  }[];
  version: {
    major: number;
    minor: number;
    patch: number;
    hash: string;
  };
  author: {
    id: string;
    name: string;
    role: string;
  };
  metadata: {
    affectedFiles: string[];
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresReview: boolean;
    autoApproved: boolean;
  };
}

export interface DocumentationState {
  version: string;
  lastUpdated: string;
  isRealTimeEnabled: boolean;
  pendingUpdates: DocumentationUpdate[];
  appliedUpdates: DocumentationUpdate[];
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  conflictResolution: 'auto' | 'manual' | 'disabled';
}

export interface Context7Config {
  autoSync: boolean;
  syncInterval: number;
  maxPendingUpdates: number;
  enableVersionControl: boolean;
  enableChangeTracking: boolean;
  enableRealTimeNotifications: boolean;
  conflictResolution: 'auto' | 'manual' | 'disabled';
  retryAttempts: number;
  retryDelay: number;
}

class Context7Service {
  private static instance: Context7Service;
  private config: Context7Config;
  private state: DocumentationState;
  private subscribers: Map<string, (update: DocumentationUpdate) => void>;
  private syncTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private constructor() {
    this.config = {
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      maxPendingUpdates: 100,
      enableVersionControl: true,
      enableChangeTracking: true,
      enableRealTimeNotifications: true,
      conflictResolution: 'auto',
      retryAttempts: 3,
      retryDelay: 1000,
    };

    this.state = {
      version: '0.0.0',
      lastUpdated: new Date().toISOString(),
      isRealTimeEnabled: false,
      pendingUpdates: [],
      appliedUpdates: [],
      syncStatus: 'offline',
      conflictResolution: 'auto',
    };

    this.subscribers = new Map();
  }

  public static getInstance(): Context7Service {
    if (!Context7Service.instance) {
      Context7Service.instance = new Context7Service();
    }
    return Context7Service.instance;
  }

  public async initialize(webSocketContext?: WebSocketContext): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load initial documentation state
      await this.loadDocumentationState();

      // Set up WebSocket subscriptions for real-time updates
      if (webSocketContext) {
        this.setupWebSocketSubscriptions(webSocketContext);
      }

      // Start auto-sync if enabled
      if (this.config.autoSync) {
        this.startAutoSync();
      }

      this.isInitialized = true;
      this.state.isRealTimeEnabled = true;
      this.state.syncStatus = 'synced';

      console.debug('Context7 service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Context7 service:', error);
      this.state.syncStatus = 'error';
      throw error;
    }
  }

  private async loadDocumentationState(): Promise<void> {
    try {
      const response = await utilitiesApi.getDocumentation();
      const docInfo = response.data as
        | { version?: string; lastUpdated?: string }
        | undefined;

      if (docInfo && typeof docInfo === 'object') {
        this.state.version = docInfo.version || '';
        this.state.lastUpdated = docInfo.lastUpdated || '';
      }

      // Load any pending updates from local storage
      const storedUpdates = localStorage.getItem('context7_pending_updates');
      if (storedUpdates) {
        this.state.pendingUpdates = JSON.parse(storedUpdates);
      }

      // Load applied updates history
      const appliedUpdates = localStorage.getItem('context7_applied_updates');
      if (appliedUpdates) {
        this.state.appliedUpdates = JSON.parse(appliedUpdates).slice(-50); // Keep last 50
      }
    } catch (error) {
      console.error('Failed to load documentation state:', error);
      throw error;
    }
  }

  private setupWebSocketSubscriptions(
    webSocketContext: WebSocketContext
  ): void {
    // Subscribe to documentation updates
    webSocketContext.subscribe('documentation_updates');

    // Handle incoming documentation update messages
    const originalOnMessage = webSocketContext.onMessage;
    webSocketContext.onMessage = (message: {
      type?: string;
      data?: unknown;
    }) => {
      if (message.type === 'documentation_update') {
        this.handleDocumentationUpdate(message.data as Record<string, unknown>);
      }

      // Call original message handler
      if (originalOnMessage) {
        originalOnMessage(message);
      }
    };
  }

  private handleDocumentationUpdate(updateData: Record<string, unknown>): void {
    const update: DocumentationUpdate = {
      id: (updateData.id as string) || this.generateUpdateId(),
      type:
        (updateData.type as DocumentationUpdate['type']) || 'content_change',
      timestamp: (updateData.timestamp as string) || new Date().toISOString(),
      source: (updateData.source as string) || 'external',
      changes: (updateData.changes as DocumentationUpdate['changes']) || [],
      version:
        (updateData.version as DocumentationUpdate['version']) ||
        this.incrementVersion(),
      author: (updateData.author as DocumentationUpdate['author']) || {
        id: 'system',
        name: 'System',
        role: 'system',
      },
      metadata: {
        affectedFiles: (updateData.affectedFiles as string[]) || [],
        impactLevel:
          (updateData.impactLevel as 'low' | 'medium' | 'high' | 'critical') ||
          'medium',
        requiresReview: (updateData.requiresReview as boolean) || false,
        autoApproved: (updateData.autoApproved as boolean) ?? true,
      },
    };

    // Add to pending updates
    this.state.pendingUpdates.push(update);

    // Limit pending updates
    if (this.state.pendingUpdates.length > this.config.maxPendingUpdates) {
      this.state.pendingUpdates = this.state.pendingUpdates.slice(
        -this.config.maxPendingUpdates
      );
    }

    // Save to local storage
    this.savePendingUpdates();

    // Notify subscribers
    this.notifySubscribers(update);

    // Show real-time notification if enabled
    if (this.config.enableRealTimeNotifications) {
      this.showUpdateNotification(update);
    }

    // Auto-apply if configured
    if (
      update.metadata.autoApproved &&
      this.config.conflictResolution === 'auto'
    ) {
      this.applyUpdate(update);
    }
  }

  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private incrementVersion(): {
    major: number;
    minor: number;
    patch: number;
    hash: string;
  } {
    const versionParts = this.state.version.split('.');
    const major = parseInt(versionParts[0] || '0', 10) || 0;
    const minor = parseInt(versionParts[1] || '0', 10) || 0;
    const patch = parseInt(versionParts[2] || '0', 10) || 0;

    return {
      major,
      minor,
      patch: patch + 1,
      hash: this.generateVersionHash(),
    };
  }

  private generateVersionHash(): string {
    return Math.random().toString(36).substr(2, 8);
  }

  private savePendingUpdates(): void {
    localStorage.setItem(
      'context7_pending_updates',
      JSON.stringify(this.state.pendingUpdates)
    );
  }

  private saveAppliedUpdates(): void {
    localStorage.setItem(
      'context7_applied_updates',
      JSON.stringify(this.state.appliedUpdates)
    );
  }

  private notifySubscribers(update: DocumentationUpdate): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    });
  }

  private showUpdateNotification(update: DocumentationUpdate): void {
    const message = `Documentation updated: ${update.changes.length} change(s) in ${update.changes[0]?.file || 'multiple files'}`;

    switch (update.metadata.impactLevel) {
      case 'critical':
        toast.error('Critical Documentation Update', { description: message });
        break;
      case 'high':
        toast.warning('Important Documentation Update', {
          description: message,
        });
        break;
      case 'medium':
        toast.info('Documentation Update', { description: message });
        break;
      case 'low':
        toast('Documentation Update', { description: message });
        break;
    }
  }

  public async applyUpdate(update: DocumentationUpdate): Promise<void> {
    try {
      this.state.syncStatus = 'syncing';

      // Apply the update through the API
      await this.applyUpdateToServer(update);

      // Move from pending to applied
      this.state.pendingUpdates = this.state.pendingUpdates.filter(
        (u) => u.id !== update.id
      );
      this.state.appliedUpdates.push(update);

      // Update version and timestamp
      this.state.version = `${update.version.major}.${update.version.minor}.${update.version.patch}`;
      this.state.lastUpdated = update.timestamp;

      // Save state
      this.savePendingUpdates();
      this.saveAppliedUpdates();

      this.state.syncStatus = 'synced';

      console.debug(`Applied documentation update: ${update.id}`);
    } catch (error) {
      console.error('Failed to apply documentation update:', error);
      this.state.syncStatus = 'error';
      throw error;
    }
  }

  private async applyUpdateToServer(
    _update: DocumentationUpdate
  ): Promise<void> {
    // This would typically make an API call to apply the update
    // For now, we'll simulate the API call
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In a real implementation, this would:
    // 1. Send the update to the server
    // 2. Validate the changes
    // 3. Apply the changes to the documentation files
    // 4. Update version control
    // 5. Notify other clients
  }

  public async syncDocumentation(): Promise<void> {
    try {
      this.state.syncStatus = 'syncing';

      // Refresh documentation from server
      await utilitiesApi.refreshDocumentation();

      // Apply any pending updates
      for (const update of this.state.pendingUpdates) {
        if (update.metadata.autoApproved) {
          await this.applyUpdate(update);
        }
      }

      this.state.syncStatus = 'synced';
      console.debug('Documentation synchronized successfully');
    } catch (error) {
      console.error('Failed to sync documentation:', error);
      this.state.syncStatus = 'error';
      throw error;
    }
  }

  public subscribe(
    id: string,
    callback: (update: DocumentationUpdate) => void
  ): void {
    this.subscribers.set(id, callback);
  }

  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  public getState(): DocumentationState {
    return { ...this.state };
  }

  public getConfig(): Context7Config {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<Context7Config>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart auto-sync if interval changed
    if (newConfig.syncInterval && this.config.autoSync) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  public getPendingUpdates(): DocumentationUpdate[] {
    return [...this.state.pendingUpdates];
  }

  public getAppliedUpdates(): DocumentationUpdate[] {
    return [...this.state.appliedUpdates];
  }

  public async approveUpdate(updateId: string): Promise<void> {
    const update = this.state.pendingUpdates.find((u) => u.id === updateId);
    if (update) {
      await this.applyUpdate(update);
    }
  }

  public rejectUpdate(updateId: string): void {
    this.state.pendingUpdates = this.state.pendingUpdates.filter(
      (u) => u.id !== updateId
    );
    this.savePendingUpdates();
  }

  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncDocumentation().catch(console.error);
    }, this.config.syncInterval);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  public destroy(): void {
    this.stopAutoSync();
    this.subscribers.clear();
    this.isInitialized = false;
    this.state.isRealTimeEnabled = false;
    this.state.syncStatus = 'offline';
  }
}

// Export singleton instance
export const context7 = Context7Service.getInstance();

// Export hook for React components
export const useContext7 = () => {
  const webSocketContext = useWebSocketContext();

  return {
    ...context7,
    initialize: () => context7.initialize(webSocketContext),
  };
};

export default context7;
