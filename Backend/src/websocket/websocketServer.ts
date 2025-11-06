/* eslint-disable @typescript-eslint/no-explicit-any */
// import { randomUUID } from 'crypto'; // Unused
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
}

class WebSocketServer {
  private io: SocketIOServer | null = null;
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private roomSubscriptions: Map<string, Set<string>> = new Map();

  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/ws',
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Authenticate socket
      this.authenticateSocket(socket);

      // Store connected client
      this.connectedClients.set(socket.id, socket);

      // Handle events
      this.setupEventHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
        this.handleDisconnection(socket);
      });

      // Send welcome message
      socket.emit('welcome', {
        message: 'Connected to CLMS WebSocket',
        socketId: socket.id,
        timestamp: new Date(),
      });
    });

    logger.info('WebSocket server initialized');
  }

  private authenticateSocket(socket: AuthenticatedSocket) {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      logger.warn(
        `WebSocket authentication failed: No token for socket ${socket.id}`,
      );
      socket.emit('error', { message: 'Authentication token required' });
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(
        token as string,
        process.env.JWT_SECRET || 'your-secret-key',
      ) as any;
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      logger.info(
        `WebSocket authenticated: ${socket.id}, User: ${socket.userId}, Role: ${socket.userRole}`,
      );
    } catch (error) {
      logger.error(
        `WebSocket authentication failed for socket ${socket.id}:`,
        error,
      );
      socket.emit('error', { message: 'Invalid authentication token' });
      socket.disconnect();
    }
  }

  private setupEventHandlers(socket: AuthenticatedSocket) {
    // Subscribe to channels
    socket.on('subscribe', (data: { subscription: string }) => {
      if (data.subscription) {
        void socket.join(data.subscription);
        const subscribers =
          this.roomSubscriptions.get(data.subscription) || new Set();
        subscribers.add(socket.id);
        this.roomSubscriptions.set(data.subscription, subscribers);

        socket.emit('subscription_confirmed', {
          subscription: data.subscription,
          timestamp: new Date(),
        });

        logger.info(`Socket ${socket.id} subscribed to ${data.subscription}`);
      }
    });

    // Unsubscribe from channels
    socket.on('unsubscribe', (data: { subscription: string }) => {
      if (data.subscription) {
        void socket.leave(data.subscription);
        const subscribers = this.roomSubscriptions.get(data.subscription);
        if (subscribers) {
          subscribers.delete(socket.id);
        }

        socket.emit('unsubscribed', {
          subscription: data.subscription,
          timestamp: new Date(),
        });

        logger.info(
          `Socket ${socket.id} unsubscribed from ${data.subscription}`,
        );
      }
    });

    // Handle ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Handle dashboard data requests
    socket.on(
      'dashboard_request',
      async (data: { dataType: string; filters?: any }) => {
        try {
          // Simple dashboard data example
          const dashboardData = {
            overview: {
              total_students: await prisma.students.count(),
              total_books: await prisma.books.count(),
              active_borrows: await prisma.book_checkouts.count({
                where: { status: 'ACTIVE' },
              }),
              overdue_borrows: await prisma.book_checkouts.count({
                where: {
                  status: 'ACTIVE',
                  due_date: { lt: new Date() },
                },
              }),
            },
          };

          socket.emit('dashboard_data', {
            dataType: data.dataType,
            data: dashboardData,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.error('Error handling dashboard request:', error);
          socket.emit('error', { message: 'Failed to fetch dashboard data' });
        }
      },
    );
  }

  private handleDisconnection(socket: AuthenticatedSocket) {
    // Clean up room subscriptions
    this.roomSubscriptions.forEach((subscribers, room) => {
      subscribers.delete(socket.id);
      if (subscribers.size === 0) {
        this.roomSubscriptions.delete(room);
      }
    });
  }

  // Public methods for broadcasting
  public broadcastToRoom(room: string, message: WebSocketMessage) {
    if (!this.io) {
      return;
    }
    this.io.to(room).emit('message', message);
  }

  public broadcastToAll(message: WebSocketMessage) {
    if (!this.io) {
      return;
    }
    this.io.emit('message', message);
  }

  /**
   * Emit student check-in event to attendance channel
   */
  public emitStudentCheckIn(data: {
    activityId: string;
    studentId: string;
    studentName: string;
    checkinTime: string;
    autoLogoutAt: string;
    reminders?: any[];
    customMessage?: string;
  }) {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit check-in event');
      return;
    }

    const message: WebSocketMessage = {
      id: data.activityId,
      type: 'student_checkin',
      data,
      timestamp: new Date(),
    };

    // Emit to attendance channel
    this.io.to('attendance').emit('message', message);
    
    logger.info('Student check-in event emitted', {
      activityId: data.activityId,
      studentId: data.studentId,
      subscriberCount: this.roomSubscriptions.get('attendance')?.size || 0,
    });
  }

  /**
   * Emit student check-out event to attendance channel
   */
  public emitStudentCheckOut(data: {
    activityId: string;
    studentId: string;
    studentName: string;
    checkoutTime: string;
    reason: 'manual' | 'auto';
    customMessage?: string;
  }) {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit check-out event');
      return;
    }

    const message: WebSocketMessage = {
      id: data.activityId,
      type: 'student_checkout',
      data,
      timestamp: new Date(),
    };

    // Emit to attendance channel
    this.io.to('attendance').emit('message', message);
    
    logger.info('Student check-out event emitted', {
      activityId: data.activityId,
      studentId: data.studentId,
      reason: data.reason,
      subscriberCount: this.roomSubscriptions.get('attendance')?.size || 0,
    });
  }

  public getStats() {
    return {
      totalConnections: this.connectedClients.size,
      connectionsByRole: this.getConnectionsByRole(),
    };
  }

  private getConnectionsByRole(): Record<string, number> {
    const roleCounts: Record<string, number> = {};
    this.connectedClients.forEach(socket => {
      const role = socket.userRole || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    return roleCounts;
  }
}

export const websocketServer = new WebSocketServer();
export const webSocketManager = websocketServer;
export default websocketServer;
