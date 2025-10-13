import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '@/utils/logger';
import { verifyToken } from '@/services/authService';
import { prisma } from '@/utils/prisma';

export interface EquipmentWebSocketMessage {
  type: 'EQUIPMENT_UPDATE' | 'RESERVATION_UPDATE' | 'MAINTENANCE_UPDATE' | 'CONDITION_REPORT_UPDATE' | 'SESSION_UPDATE';
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STARTED' | 'ENDED';
  data: any;
  equipmentId?: string;
  timestamp: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  role?: string;
  lastPing?: number;
}

export class EquipmentWebSocketService {
  private wss: WebSocketServer;
  private heartbeatInterval: NodeJS.Timeout;
  private connections: Map<string, AuthenticatedWebSocket> = new Map();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupHeartbeat();
    this.setupEventHandlers();
  }

  private setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((ws, connectionId) => {
        if (ws.lastPing && Date.now() - ws.lastPing > 30000) {
          logger.info('WebSocket connection timeout, closing', { connectionId });
          ws.terminate();
          this.connections.delete(connectionId);
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 15000); // Check every 15 seconds
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      const connectionId = this.generateConnectionId();

      logger.info('New WebSocket connection established', {
        connectionId,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      ws.connectionId = connectionId;
      this.connections.set(connectionId, ws);

      // Handle messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Error handling WebSocket message', {
            error: (error as Error).message,
            connectionId,
          });
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle pong responses
      ws.on('pong', () => {
        ws.lastPing = Date.now();
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        logger.info('WebSocket connection closed', {
          connectionId,
          code,
          reason: reason.toString(),
        });
        this.connections.delete(connectionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error', {
          error: error.message,
          connectionId,
        });
        this.connections.delete(connectionId);
      });

      // Send initial ping
      ws.lastPing = Date.now();
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: any) {
    const { type, data } = message;

    switch (type) {
      case 'AUTHENTICATE':
        await this.handleAuthentication(ws, data);
        break;
      case 'SUBSCRIBE_EQUIPMENT':
        this.handleEquipmentSubscription(ws, data);
        break;
      case 'UNSUBSCRIBE_EQUIPMENT':
        this.handleEquipmentUnsubscription(ws, data);
        break;
      case 'EQUIPMENT_ACTION':
        await this.handleEquipmentAction(ws, data);
        break;
      default:
        logger.warn('Unknown WebSocket message type', { type, connectionId: ws.connectionId });
        this.sendError(ws, 'Unknown message type');
    }
  }

  private async handleAuthentication(ws: AuthenticatedWebSocket, data: { token: string }) {
    try {
      const { token } = data;
      if (!token) {
        this.sendError(ws, 'Authentication token required');
        return;
      }

      const user = await verifyToken(token);
      if (!user) {
        this.sendError(ws, 'Invalid authentication token');
        return;
      }

      ws.userId = user.id;
      ws.username = user.username;
      ws.role = user.role;

      this.sendMessage(ws, {
        type: 'AUTHENTICATED',
        data: { user: { id: user.id, username: user.username, role: user.role } },
        timestamp: new Date().toISOString(),
      });

      logger.info('WebSocket authenticated', {
        connectionId: ws.connectionId,
        userId: user.id,
        username: user.username,
      });
    } catch (error) {
      logger.error('WebSocket authentication error', {
        error: (error as Error).message,
        connectionId: ws.connectionId,
      });
      this.sendError(ws, 'Authentication failed');
    }
  }

  private handleEquipmentSubscription(ws: AuthenticatedWebSocket, data: { equipmentId?: string }) {
    if (!ws.userId) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    const { equipmentId } = data;

    // Store subscription information
    ws.subscribedEquipment = ws.subscribedEquipment || new Set();
    if (equipmentId) {
      ws.subscribedEquipment.add(equipmentId);
    } else {
      // Subscribe to all equipment updates
      ws.subscribedAll = true;
    }

    this.sendMessage(ws, {
      type: 'SUBSCRIBED',
      data: { equipmentId, subscribedAll: ws.subscribedAll },
      timestamp: new Date().toISOString(),
    });

    logger.info('WebSocket equipment subscription', {
      connectionId: ws.connectionId,
      userId: ws.userId,
      equipmentId,
    });
  }

  private handleEquipmentUnsubscription(ws: AuthenticatedWebSocket, data: { equipmentId?: string }) {
    if (!ws.userId) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    const { equipmentId } = data;

    if (ws.subscribedEquipment) {
      if (equipmentId) {
        ws.subscribedEquipment.delete(equipmentId);
      } else {
        ws.subscribedEquipment.clear();
      }
    }

    if (equipmentId === undefined) {
      ws.subscribedAll = false;
    }

    this.sendMessage(ws, {
      type: 'UNSUBSCRIBED',
      data: { equipmentId },
      timestamp: new Date().toISOString(),
    });

    logger.info('WebSocket equipment unsubscription', {
      connectionId: ws.connectionId,
      userId: ws.userId,
      equipmentId,
    });
  }

  private async handleEquipmentAction(ws: AuthenticatedWebSocket, data: any) {
    if (!ws.userId) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    const { action, equipmentId, payload } = data;

    try {
      let result;
      switch (action) {
        case 'START_SESSION':
          result = await this.handleStartSession(ws.userId, equipmentId, payload);
          break;
        case 'END_SESSION':
          result = await this.handleEndSession(ws.userId, equipmentId, payload);
          break;
        case 'UPDATE_STATUS':
          result = await this.handleStatusUpdate(ws.userId, equipmentId, payload);
          break;
        default:
          this.sendError(ws, 'Unknown equipment action');
          return;
      }

      this.sendMessage(ws, {
        type: 'ACTION_COMPLETED',
        data: { action, equipmentId, result },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Equipment action error', {
        error: (error as Error).message,
        action,
        equipmentId,
        userId: ws.userId,
      });
      this.sendError(ws, (error as Error).message);
    }
  }

  private async handleStartSession(userId: string, equipmentId: string, payload: any) {
    // Implementation for starting equipment session
    // This would interact with the equipment service
    logger.info('Starting equipment session', { userId, equipmentId, payload });
    return { success: true, sessionId: 'session_' + Date.now() };
  }

  private async handleEndSession(userId: string, equipmentId: string, payload: any) {
    // Implementation for ending equipment session
    logger.info('Ending equipment session', { userId, equipmentId, payload });
    return { success: true };
  }

  private async handleStatusUpdate(userId: string, equipmentId: string, payload: any) {
    // Implementation for updating equipment status
    logger.info('Updating equipment status', { userId, equipmentId, payload });
    return { success: true };
  }

  // Public broadcasting methods
  public broadcastEquipmentUpdate(message: EquipmentWebSocketMessage) {
    this.broadcast(message, (ws) => {
      return this.shouldReceiveEquipmentUpdate(ws, message.equipmentId);
    });
  }

  public broadcastReservationUpdate(message: EquipmentWebSocketMessage) {
    this.broadcast(message, (ws) => {
      return this.shouldReceiveEquipmentUpdate(ws, message.equipmentId);
    });
  }

  public broadcastMaintenanceUpdate(message: EquipmentWebSocketMessage) {
    this.broadcast(message, (ws) => {
      return this.shouldReceiveEquipmentUpdate(ws, message.equipmentId);
    });
  }

  public broadcastConditionReportUpdate(message: EquipmentWebSocketMessage) {
    this.broadcast(message, (ws) => {
      return this.shouldReceiveEquipmentUpdate(ws, message.equipmentId);
    });
  }

  public broadcastSessionUpdate(message: EquipmentWebSocketMessage) {
    this.broadcast(message, (ws) => {
      return this.shouldReceiveEquipmentUpdate(ws, message.equipmentId);
    });
  }

  private broadcast(message: EquipmentWebSocketMessage, filter?: (ws: AuthenticatedWebSocket) => boolean) {
    const messageString = JSON.stringify(message);
    let sentCount = 0;

    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && (!filter || filter(ws))) {
        try {
          ws.send(messageString);
          sentCount++;
        } catch (error) {
          logger.error('Error sending WebSocket message', {
            error: (error as Error).message,
            connectionId: ws.connectionId,
          });
        }
      }
    });

    logger.debug('WebSocket broadcast completed', {
      messageType: message.type,
      sentCount,
      totalConnections: this.connections.size,
    });
  }

  private shouldReceiveEquipmentUpdate(ws: AuthenticatedWebSocket, equipmentId?: string): boolean {
    if (!ws.userId) return false;

    if (ws.subscribedAll) return true;
    if (ws.subscribedEquipment && ws.subscribedEquipment.has(equipmentId)) return true;

    return false;
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending WebSocket message', {
          error: (error as Error).message,
          connectionId: ws.connectionId,
        });
      }
    }
  }

  private sendError(ws: AuthenticatedWebSocket, message: string) {
    this.sendMessage(ws, {
      type: 'ERROR',
      data: { message },
      timestamp: new Date().toISOString(),
    });
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getConnectedClients(): number {
    return this.connections.size;
  }

  public getAuthenticatedClients(): number {
    let count = 0;
    this.connections.forEach((ws) => {
      if (ws.userId) count++;
    });
    return count;
  }

  public shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.connections.forEach((ws) => {
      ws.close(1000, 'Server shutting down');
    });

    this.connections.clear();
  }
}

// Extend WebSocket interface to include custom properties
declare module 'ws' {
  interface WebSocket {
    connectionId?: string;
    userId?: string;
    username?: string;
    role?: string;
    lastPing?: number;
    subscribedEquipment?: Set<string>;
    subscribedAll?: boolean;
  }
}