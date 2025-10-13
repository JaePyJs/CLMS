import { WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { authService, JWTPayload } from '../services/authService';

export interface ClientConnection {
  id: string;
  userId: string;
  username: string;
  role: string;
  socket: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  isAlive: boolean;
}

export interface MessageQueue {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retries: number;
  maxRetries: number;
}

export class ClientManager {
  private clients: Map<string, ClientConnection> = new Map();
  private userIdToClientId: Map<string, string> = new Map();
  private messageQueues: Map<string, MessageQueue[]> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private heartbeatInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {}, 0); // Initialize
    this.heartbeatInterval = setInterval(() => {}, 0); // Initialize
    this.setupHeartbeat();
    this.setupCleanup();
    logger.info('ClientManager initialized');
  }

  /**
   * Add a new client connection
   */
  addClient(client: ClientConnection): void {
    this.clients.set(client.id, client);
    this.userIdToClientId.set(client.userId, client.id);

    // Initialize message queue for client
    this.messageQueues.set(client.id, []);

    logger.info('Client connected', {
      clientId: client.id,
      userId: client.userId,
      username: client.username,
      role: client.role,
      totalClients: this.clients.size
    });

    // Notify other clients about new connection
    this.broadcastToRole('staff', {
      type: 'user_connected',
      data: {
        userId: client.userId,
        username: client.username,
        role: client.role,
        connectedAt: client.connectedAt
      }
    }, client.id);
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);
    this.userIdToClientId.delete(client.userId);
    this.messageQueues.delete(clientId);

    logger.info('Client disconnected', {
      clientId,
      userId: client.userId,
      username: client.username,
      remainingClients: this.clients.size
    });

    // Notify other clients about disconnection
    this.broadcastToRole('staff', {
      type: 'user_disconnected',
      data: {
        userId: client.userId,
        username: client.username,
        role: client.role,
        disconnectedAt: new Date()
      }
    }, clientId);
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get client by user ID
   */
  getClientByUserId(id: string): ClientConnection | undefined {
    const clientId = this.userIdToClientId.get(id);
    return clientId ? this.clients.get(clientId) : undefined;
  }

  /**
   * Get all clients
   */
  getAllClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get clients by role
   */
  getClientsByRole(role: string): ClientConnection[] {
    return Array.from(this.clients.values()).filter(client => client.role === role);
  }

  /**
   * Get clients subscribed to a specific topic
   */
  getClientsBySubscription(subscription: string): ClientConnection[] {
    return Array.from(this.clients.values()).filter(client =>
      client.subscriptions.has(subscription)
    );
  }

  /**
   * Update client activity timestamp
   */
  updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
      client.isAlive = true;
    }
  }

  /**
   * Add subscription for client
   */
  addSubscription(clientId: string, subscription: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(subscription);
      logger.debug('Client subscription added', {
        clientId,
        id: client.id,
        subscription
      });
    }
  }

  /**
   * Remove subscription for client
   */
  removeSubscription(clientId: string, subscription: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(subscription);
      logger.debug('Client subscription removed', {
        clientId,
        id: client.id,
        subscription
      });
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messagePayload = {
        id: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        ...message
      };

      client.socket.send(JSON.stringify(messagePayload));
      this.updateClientActivity(clientId);
      return true;
    } catch (error) {
      logger.error('Failed to send message to client', {
        clientId,
        id: client.id,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Send message to user (all their connections)
   */
  sendToUser(id: string, message: any): boolean {
    const client = this.getClientByUserId(id);
    if (!client) {
      // Queue message for when user reconnects
      this.queueMessageForUser(id, message);
      return false;
    }

    return this.sendToClient(client.id, message);
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: any, excludeClientId?: string): void {
    const messagePayload = {
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      ...message
    };

    let sentCount = 0;
    let failedCount = 0;

    this.clients.forEach((client, clientId) => {
      if (excludeClientId && clientId === excludeClientId) return;
      if (client.socket.readyState !== WebSocket.OPEN) {
        failedCount++;
        return;
      }

      try {
        client.socket.send(JSON.stringify(messagePayload));
        this.updateClientActivity(clientId);
        sentCount++;
      } catch (error) {
        logger.error('Failed to broadcast to client', {
          clientId,
          id: client.id,
          error: (error as Error).message
        });
        failedCount++;
      }
    });

    logger.debug('Message broadcasted', {
      type: message.type,
      sentCount,
      failedCount,
      totalClients: this.clients.size
    });
  }

  /**
   * Broadcast message to clients with specific role
   */
  broadcastToRole(role: string, message: any, excludeClientId?: string): void {
    const messagePayload = {
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      ...message
    };

    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (excludeClientId && clientId === excludeClientId) return;
      if (client.role !== role || client.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        client.socket.send(JSON.stringify(messagePayload));
        this.updateClientActivity(clientId);
        sentCount++;
      } catch (error) {
        logger.error('Failed to broadcast to role', {
          clientId,
          id: client.id,
          role,
          error: (error as Error).message
        });
      }
    });

    logger.debug('Message broadcasted to role', {
      role,
      type: message.type,
      sentCount,
      totalRoleClients: this.getClientsByRole(role).length
    });
  }

  /**
   * Broadcast message to clients subscribed to a topic
   */
  broadcastToSubscription(subscription: string, message: any, excludeClientId?: string): void {
    const messagePayload = {
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      ...message
    };

    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (excludeClientId && clientId === excludeClientId) return;
      if (!client.subscriptions.has(subscription) || client.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        client.socket.send(JSON.stringify(messagePayload));
        this.updateClientActivity(clientId);
        sentCount++;
      } catch (error) {
        logger.error('Failed to broadcast to subscription', {
          clientId,
          id: client.id,
          subscription,
          error: (error as Error).message
        });
      }
    });

    logger.debug('Message broadcasted to subscription', {
      subscription,
      type: message.type,
      sentCount,
      totalSubscribedClients: this.getClientsBySubscription(subscription).length
    });
  }

  /**
   * Queue message for user when they're offline
   */
  private queueMessageForUser(id: string, message: any): void {
    const priority = this.getMessagePriority(message.type);
    const queuedMessage: MessageQueue = {
      id: this.generateMessageId(),
      type: message.type,
      data: message,
      timestamp: new Date(),
      priority,
      retries: 0,
      maxRetries: priority === 'critical' ? 5 : 3
    };

    // Find or create queue for user's potential connections
    let queue: MessageQueue[] = [];
    this.messageQueues.forEach((clientQueue, clientId) => {
      const client = this.clients.get(clientId);
      if (client && client.id === id) {
        queue = clientQueue;
      }
    });

    // If no active connection, create temporary queue
    if (queue.length === 0) {
      queue = [];
    }

    // Add message to queue (maintain priority order)
    queue.push(queuedMessage);
    queue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    logger.debug('Message queued for user', {
      id,
      messageId: queuedMessage.id,
      type: message.type,
      priority,
      queueSize: queue.length
    });
  }

  /**
   * Get message priority based on type
   */
  private getMessagePriority(type: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalTypes = ['emergency_alert', 'system_shutdown', 'security_breach'];
    const highTypes = ['student_checkout', 'equipment_malfunction', 'inventory_alert'];
    const mediumTypes = ['student_checkin', 'activity_update', 'notification'];

    if (criticalTypes.includes(type)) return 'critical';
    if (highTypes.includes(type)) return 'high';
    if (mediumTypes.includes(type)) return 'medium';
    return 'low';
  }

  /**
   * Setup heartbeat mechanism
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          logger.warn('Client failed heartbeat, terminating connection', {
            clientId,
            id: client.id,
            username: client.username
          });
          client.socket.terminate();
          this.removeClient(clientId);
          return;
        }

        client.isAlive = false;

        try {
          client.socket.ping();
        } catch (error) {
          logger.error('Failed to send ping to client', {
            clientId,
            id: client.id,
            error: (error as Error).message
          });
          this.removeClient(clientId);
        }
      });
    }, 30000); // 30 seconds
  }

  /**
   * Setup cleanup mechanism
   */
  private setupCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      this.clients.forEach((client, clientId) => {
        // Check for stale connections
        if (now.getTime() - client.lastActivity.getTime() > staleThreshold) {
          logger.warn('Removing stale client connection', {
            clientId,
            id: client.id,
            username: client.username,
            lastActivity: client.lastActivity
          });
          client.socket.terminate();
          this.removeClient(clientId);
        }
      });

      // Clean up old message queues
      this.messageQueues.forEach((queue, clientId) => {
        const filteredQueue = queue.filter(msg => {
          const messageAge = now.getTime() - msg.timestamp.getTime();
          const maxAge = msg.priority === 'critical' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000; // 24h for critical, 1h for others
          return messageAge < maxAge;
        });

        if (filteredQueue.length !== queue.length) {
          this.messageQueues.set(clientId, filteredQueue);
        }
      });
    }, 60000); // 1 minute
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    connectionsByRole: Record<string, number>;
    averageConnectionTime: number;
    subscriptionsCount: number;
  } {
    const clients = Array.from(this.clients.values());
    const now = new Date();

    const connectionsByRole: Record<string, number> = {};
    let totalConnectionTime = 0;
    let subscriptionsCount = 0;

    clients.forEach(client => {
      // Count by role
      connectionsByRole[client.role] = (connectionsByRole[client.role] || 0) + 1;

      // Calculate connection time
      totalConnectionTime += now.getTime() - client.connectedAt.getTime();

      // Count subscriptions
      subscriptionsCount += client.subscriptions.size;
    });

    return {
      totalConnections: clients.length,
      connectionsByRole,
      averageConnectionTime: clients.length > 0 ? totalConnectionTime / clients.length : 0,
      subscriptionsCount
    };
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    logger.info('Shutting down ClientManager...');

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all connections
    this.clients.forEach((client, clientId) => {
      try {
        client.socket.close(1001, 'Server shutdown');
      } catch (error) {
        logger.error('Error closing client connection during shutdown', {
          clientId,
          error: (error as Error).message
        });
      }
    });

    // Clear all data
    this.clients.clear();
    this.userIdToClientId.clear();
    this.messageQueues.clear();

    logger.info('ClientManager shutdown complete');
  }
}

export const clientManager = new ClientManager();