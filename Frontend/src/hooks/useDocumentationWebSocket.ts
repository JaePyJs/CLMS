import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { context7, type DocumentationUpdate } from '@/services/context7';
import { utilitiesApi } from '@/lib/api';
import { toast } from 'sonner';
import { hasProperty } from '@/utils/errorHandling';

export interface DocumentationWebSocketConfig {
  autoSubscribe: boolean;
  subscriptionTypes: Array<
    'content_change' | 'structure_change' | 'metadata_update' | 'version_update'
  >;
  targetFiles?: string[];
  impactLevels?: Array<'low' | 'medium' | 'high' | 'critical'>;
  enableNotifications: boolean;
  enableAutoApproval: boolean;
  conflictResolution: 'auto' | 'manual' | 'disabled';
}

export interface DocumentationWebSocketHandlers {
  onUpdate?: (update: DocumentationUpdate) => void;
  onVersionChange?: (version: string) => void;
  onConflict?: (conflictId: string, details: any) => void;
  onSyncStatusChange?: (
    status: 'synced' | 'syncing' | 'error' | 'offline'
  ) => void;
  onValidationError?: (errors: any[]) => void;
  onSnapshotCreated?: (snapshot: any) => void;
}

const DEFAULT_CONFIG: DocumentationWebSocketConfig = {
  autoSubscribe: true,
  subscriptionTypes: [
    'content_change',
    'structure_change',
    'metadata_update',
    'version_update',
  ],
  enableNotifications: true,
  enableAutoApproval: false,
  conflictResolution: 'manual',
};

export const useDocumentationWebSocket = (
  config: Partial<DocumentationWebSocketConfig> = {},
  handlers: DocumentationWebSocketHandlers = {}
) => {
  const webSocketContext = useWebSocketContext();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const handlersRef = useRef(handlers);
  const subscriptionIdRef = useRef<string | null>(null);
  const isSubscribedRef = useRef(false);

  // Update handlers ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    if (!message.type?.startsWith('documentation_')) {
      return;
    }

    const { type, data } = message;

    switch (type) {
      case 'documentation_update':
        handleDocumentationUpdate(data);
        break;
      case 'documentation_version_change':
        handleVersionChange(data);
        break;
      case 'documentation_conflict':
        handleConflict(data);
        break;
      case 'documentation_sync_status':
        handleSyncStatusChange(data);
        break;
      case 'documentation_validation_error':
        handleValidationError(data);
        break;
      case 'documentation_snapshot_created':
        handleSnapshotCreated(data);
        break;
      default:
        console.debug('Unknown documentation WebSocket message type:', type);
    }
  }, []);

  const handleDocumentationUpdate = useCallback(
    (data: unknown) => {
      // Type guard the data object
      if (typeof data !== 'object' || data === null) {
        console.error('Invalid documentation update data:', data);
        return;
      }

      const update: DocumentationUpdate = {
        id: hasProperty(data, 'id') ? (data.id as string) : '',
        type: hasProperty(data, 'type') ? (data.type as any) : 'content_change',
        timestamp: hasProperty(data, 'timestamp')
          ? (data.timestamp as string)
          : new Date().toISOString(),
        source: hasProperty(data, 'source')
          ? (data.source as string)
          : 'websocket',
        changes: hasProperty(data, 'changes') ? (data.changes as any[]) : [],
        version: hasProperty(data, 'version')
          ? (data.version as any)
          : ({} as any),
        author: hasProperty(data, 'author')
          ? (data.author as any)
          : ({} as any),
        metadata: hasProperty(data, 'metadata')
          ? (data.metadata as any)
          : ({} as any),
      };

      // Filter by configuration
      if (
        finalConfig.subscriptionTypes &&
        !finalConfig.subscriptionTypes.includes(update.type)
      ) {
        return;
      }

      if (
        finalConfig.impactLevels &&
        !finalConfig.impactLevels.includes(update.metadata.impactLevel)
      ) {
        return;
      }

      if (finalConfig.targetFiles && finalConfig.targetFiles.length > 0) {
        const hasTargetFile = update.changes.some((change) =>
          // targetFiles is validated as non-null by the if condition above
          finalConfig.targetFiles.includes(change.file)
        );
        if (!hasTargetFile) {
          return;
        }
      }

      // Notify Context7 service via subscription
      // Instead of calling private method, we'll use the public subscribe mechanism
      // The Context7 service should handle this through its WebSocket subscription setup

      // Show notification if enabled
      if (finalConfig.enableNotifications) {
        showUpdateNotification(update);
      }

      // Auto-approve if enabled and applicable
      if (finalConfig.enableAutoApproval && update.metadata.autoApproved) {
        context7.approveUpdate(update.id).catch(console.error);
      }

      // Call custom handler
      handlersRef.current.onUpdate?.(update);
    },
    [finalConfig]
  );

  const handleVersionChange = useCallback(
    (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        console.error('Invalid version change data:', data);
        return;
      }

      const version = hasProperty(data, 'version')
        ? String(data.version)
        : 'unknown';
      const previousVersion = hasProperty(data, 'previousVersion')
        ? String(data.previousVersion)
        : 'unknown';

      if (finalConfig.enableNotifications) {
        toast.info('Documentation Version Updated', {
          description: `Updated from ${previousVersion} to ${version}`,
        });
      }

      handlersRef.current.onVersionChange?.(version);
    },
    [finalConfig.enableNotifications]
  );

  const handleConflict = useCallback(
    (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        console.error('Invalid conflict data:', data);
        return;
      }

      const conflictId = hasProperty(data, 'conflictId')
        ? String(data.conflictId)
        : 'unknown';
      const details = hasProperty(data, 'details') ? data.details : {};

      if (finalConfig.enableNotifications) {
        toast.warning('Documentation Conflict Detected', {
          description: `Conflict in ${
            hasProperty(details, 'file')
              ? String(details.file)
              : 'multiple files'
          }`,
          action: {
            label: 'Resolve',
            onClick: () => {
              // Navigate to conflict resolution UI
              console.debug('Navigate to conflict resolution for:', conflictId);
            },
          },
        });
      }

      handlersRef.current.onConflict?.(conflictId, details);
    },
    [finalConfig.enableNotifications]
  );

  const handleSyncStatusChange = useCallback(
    (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        console.error('Invalid sync status data:', data);
        return;
      }

      const status = hasProperty(data, 'status')
        ? (String(data.status) as 'synced' | 'syncing' | 'error' | 'offline')
        : 'error';
      const message = hasProperty(data, 'message') ? String(data.message) : '';

      if (finalConfig.enableNotifications && status === 'error') {
        toast.error('Documentation Sync Error', {
          description: message || 'Failed to sync documentation',
        });
      }

      handlersRef.current.onSyncStatusChange?.(status);
    },
    [finalConfig.enableNotifications]
  );

  const handleValidationError = useCallback(
    (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        console.error('Invalid validation error data:', data);
        return;
      }

      const errors =
        hasProperty(data, 'errors') && Array.isArray(data.errors)
          ? data.errors
          : [];

      if (finalConfig.enableNotifications) {
        toast.error('Documentation Validation Failed', {
          description: `${errors.length} validation error(s) found`,
        });
      }

      handlersRef.current.onValidationError?.(errors);
    },
    [finalConfig.enableNotifications]
  );

  const handleSnapshotCreated = useCallback(
    (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        console.error('Invalid snapshot data:', data);
        return;
      }

      const snapshot = hasProperty(data, 'snapshot')
        ? (data.snapshot as any)
        : null;

      if (finalConfig.enableNotifications && snapshot) {
        toast.success('Documentation Snapshot Created', {
          description: `Snapshot "${snapshot.name || 'unnamed'}" created successfully`,
        });
      }

      handlersRef.current.onSnapshotCreated?.(snapshot);
    },
    [finalConfig.enableNotifications]
  );

  const showUpdateNotification = useCallback((update: DocumentationUpdate) => {
    const fileCount = update.changes.length;
    const primaryFile = update.changes[0]?.file || 'unknown';
    const message =
      fileCount === 1 ? `Updated ${primaryFile}` : `Updated ${fileCount} files`;

    switch (update.metadata.impactLevel) {
      case 'critical':
        toast.error('Critical Documentation Update', {
          description: message,
          action: {
            label: 'Review',
            onClick: () => {
              // Navigate to update review
              console.debug('Review update:', update.id);
            },
          },
        });
        break;
      case 'high':
        toast.warning('Important Documentation Update', {
          description: message,
        });
        break;
      case 'medium':
        toast.info('Documentation Update', {
          description: message,
        });
        break;
      case 'low':
        toast('Documentation Update', {
          description: message,
        });
        break;
    }
  }, []);

  // Subscribe to documentation updates
  const subscribe = useCallback(async () => {
    if (isSubscribedRef.current || !webSocketContext.isConnected) {
      return;
    }

    try {
      // Subscribe via WebSocket
      webSocketContext.subscribe('documentation_updates');
      webSocketContext.subscribe('documentation_version_changes');
      webSocketContext.subscribe('documentation_conflicts');
      webSocketContext.subscribe('documentation_sync_status');
      webSocketContext.subscribe('documentation_validation_errors');
      webSocketContext.subscribe('documentation_snapshots');

      // Subscribe via API for server-side filtering
      const subscriptionData: {
        types: Array<
          | 'content_change'
          | 'structure_change'
          | 'metadata_update'
          | 'version_update'
        >;
        files?: string[];
        impactLevels?: Array<'low' | 'medium' | 'high' | 'critical'>;
      } = {
        types: finalConfig.subscriptionTypes,
      };

      if (finalConfig.targetFiles) {
        subscriptionData.files = finalConfig.targetFiles;
      }

      if (finalConfig.impactLevels) {
        subscriptionData.impactLevels = finalConfig.impactLevels;
      }

      const response = await utilitiesApi.subscribeToUpdates(subscriptionData);

      if (response.success && (response.data as any)?.subscriptionId) {
        subscriptionIdRef.current = (response.data as any).subscriptionId;
      }

      isSubscribedRef.current = true;
      console.debug('Subscribed to documentation updates');
    } catch (error) {
      console.error('Failed to subscribe to documentation updates:', error);
      toast.error('Failed to subscribe to documentation updates');
    }
  }, [webSocketContext.isConnected, finalConfig]);

  // Unsubscribe from documentation updates
  const unsubscribe = useCallback(async () => {
    if (!isSubscribedRef.current) {
      return;
    }

    try {
      // Unsubscribe from WebSocket topics
      webSocketContext.unsubscribe('documentation_updates');
      webSocketContext.unsubscribe('documentation_version_changes');
      webSocketContext.unsubscribe('documentation_conflicts');
      webSocketContext.unsubscribe('documentation_sync_status');
      webSocketContext.unsubscribe('documentation_validation_errors');
      webSocketContext.unsubscribe('documentation_snapshots');

      // Unsubscribe via API
      if (subscriptionIdRef.current) {
        await utilitiesApi.unsubscribeFromUpdates(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }

      isSubscribedRef.current = false;
      console.debug('Unsubscribed from documentation updates');
    } catch (error) {
      console.error('Failed to unsubscribe from documentation updates:', error);
    }
  }, [webSocketContext]);

  // Set up WebSocket message handler
  useEffect(() => {
    if (!webSocketContext.isConnected) {
      return;
    }

    const originalOnMessage = (webSocketContext as any).onMessage;

    // Enhance the existing onMessage handler
    (webSocketContext as any).onMessage = (message: any) => {
      handleWebSocketMessage(message);

      // Call original handler if it exists
      if (originalOnMessage && typeof originalOnMessage === 'function') {
        originalOnMessage(message);
      }
    };

    // Auto-subscribe if enabled
    if (finalConfig.autoSubscribe) {
      subscribe();
    }

    // Cleanup function
    return () => {
      (webSocketContext as any).onMessage = originalOnMessage;
    };
  }, [
    webSocketContext.isConnected,
    handleWebSocketMessage,
    subscribe,
    finalConfig.autoSubscribe,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  // Manual subscription control
  const toggleSubscription = useCallback(async () => {
    if (isSubscribedRef.current) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }, [subscribe, unsubscribe]);

  // Force sync documentation
  const forceSync = useCallback(async () => {
    try {
      await utilitiesApi.syncDocumentationSources({ forceSync: true });
      toast.success('Documentation sync initiated');
    } catch (error) {
      console.error('Failed to force sync documentation:', error);
      toast.error('Failed to sync documentation');
    }
  }, []);

  // Validate documentation integrity
  const validateIntegrity = useCallback(async () => {
    try {
      const response = await utilitiesApi.validateDocumentationIntegrity();
      if (response.success) {
        toast.success('Documentation validation completed');
        return response.data;
      } else {
        toast.error('Documentation validation failed');
        return null;
      }
    } catch (error) {
      console.error('Failed to validate documentation:', error);
      toast.error('Failed to validate documentation');
      return null;
    }
  }, []);

  // Create documentation snapshot
  const createSnapshot = useCallback(
    async (name: string, description?: string, tags?: string[]) => {
      try {
        const snapshotData: {
          name: string;
          description?: string;
          tags?: string[];
        } = {
          name,
        };

        if (description) {
          snapshotData.description = description;
        }

        if (tags) {
          snapshotData.tags = tags;
        }

        const response =
          await utilitiesApi.createDocumentationSnapshot(snapshotData);

        if (response.success) {
          toast.success(`Snapshot "${name}" created successfully`);
          return response.data;
        } else {
          toast.error('Failed to create snapshot');
          return null;
        }
      } catch (error) {
        console.error('Failed to create documentation snapshot:', error);
        toast.error('Failed to create snapshot');
        return null;
      }
    },
    []
  );

  return {
    // State
    isSubscribed: isSubscribedRef.current,
    subscriptionId: subscriptionIdRef.current,
    isConnected: webSocketContext.isConnected,

    // Actions
    subscribe,
    unsubscribe,
    toggleSubscription,
    forceSync,
    validateIntegrity,
    createSnapshot,

    // WebSocket context
    webSocketContext,
  };
};

export default useDocumentationWebSocket;
