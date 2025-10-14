import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  username?: string;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
}

class WebSocketServer {
  private io: SocketIOServer | null = null;
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private roomSubscriptions: Map<string, Set<string>> = new Map();

  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        
        // Verify user exists
        const user = await prisma.users.findUnique({
          where: { id: decoded.userId },
          select: { id: true, username: true, role: true }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.username = user.username;

        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.setupEventHandlers();
    logger.info('WebSocket server initialized');
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`Client connected: ${socket.id} (User: ${socket.username})`);
      this.connectedClients.set(socket.id, socket);

      // Send initial connection success
      socket.emit('connected', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date()
      });

      // Room subscription handlers
      socket.on('subscribe', (room: string) => {
        this.subscribeToRoom(socket, room);
      });

      socket.on('unsubscribe', (room: string) => {
        this.unsubscribeFromRoom(socket, room);
      });

      // Equipment events
      socket.on('equipment:start-session', async (data) => {
        await this.handleEquipmentSessionStart(socket, data);
      });

      socket.on('equipment:end-session', async (data) => {
        await this.handleEquipmentSessionEnd(socket, data);
      });

      socket.on('equipment:status-update', async (data) => {
        await this.handleEquipmentStatusUpdate(socket, data);
      });

      // Student activity events
      socket.on('student:check-in', async (data) => {
        await this.handleStudentCheckIn(socket, data);
      });

      socket.on('student:check-out', async (data) => {
        await this.handleStudentCheckOut(socket, data);
      });

      // Scanner events
      socket.on('scanner:scan', async (data) => {
        await this.handleScannerInput(socket, data);
      });

      // Notification events
      socket.on('notification:send', async (data) => {
        await this.handleNotificationSend(socket, data);
      });

      // Ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });

      // Disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} (Reason: ${reason})`);
        this.handleDisconnection(socket);
      });

      // Error handling
      socket.on('error', (error) => {
        logger.error(`WebSocket error for ${socket.id}:`, error);
      });
    });
  }

  private subscribeToRoom(socket: AuthenticatedSocket, room: string) {
    socket.join(room);
    
    if (!this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.set(room, new Set());
    }
    this.roomSubscriptions.get(room)?.add(socket.id);

    logger.debug(`Socket ${socket.id} subscribed to room: ${room}`);
    socket.emit('subscribed', { room, timestamp: new Date() });
  }

  private unsubscribeFromRoom(socket: AuthenticatedSocket, room: string) {
    socket.leave(room);
    this.roomSubscriptions.get(room)?.delete(socket.id);

    logger.debug(`Socket ${socket.id} unsubscribed from room: ${room}`);
    socket.emit('unsubscribed', { room, timestamp: new Date() });
  }

  private async handleEquipmentSessionStart(socket: AuthenticatedSocket, data: any) {
    try {
      const { equipmentId, studentId, timeLimitMinutes } = data;

      // Create session in database
      const session = await prisma.equipment_sessions.create({
        data: {
          id: crypto.randomUUID(),
          equipment_id: equipmentId,
          student_id: studentId,
          session_start: new Date(),
          planned_end: new Date(Date.now() + timeLimitMinutes * 60 * 1000),
          status: 'ACTIVE',
          updated_at: new Date()
        },
        include: {
          equipment: true,
          students: true
        }
      });

      // Broadcast to equipment room
      this.broadcastToRoom('equipment', {
        type: 'session:started',
        payload: session,
        timestamp: new Date()
      });

      // Broadcast to student room
      this.broadcastToRoom(`student:${studentId}`, {
        type: 'equipment:session-started',
        payload: session,
        timestamp: new Date()
      });

      socket.emit('equipment:session-started', { success: true, session });
      logger.info(`Equipment session started: ${session.id}`);
    } catch (error) {
      logger.error('Error starting equipment session:', error);
      socket.emit('error', { message: 'Failed to start session', error });
    }
  }

  private async handleEquipmentSessionEnd(socket: AuthenticatedSocket, data: any) {
    try {
      const { sessionId } = data;

      const session = await prisma.equipment_sessions.update({
        where: { id: sessionId },
        data: {
          session_end: new Date(),
          status: 'COMPLETED'
        },
        include: {
          equipment: true,
          students: true
        }
      });

      // Broadcast to equipment room
      this.broadcastToRoom('equipment', {
        type: 'session:ended',
        payload: session,
        timestamp: new Date()
      });

      socket.emit('equipment:session-ended', { success: true, session });
      logger.info(`Equipment session ended: ${session.id}`);
    } catch (error) {
      logger.error('Error ending equipment session:', error);
      socket.emit('error', { message: 'Failed to end session', error });
    }
  }

  private async handleEquipmentStatusUpdate(socket: AuthenticatedSocket, data: any) {
    try {
      const { equipmentId, status } = data;

      const equipment = await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status },
      });

      // Broadcast to all equipment subscribers
      this.broadcastToRoom('equipment', {
        type: 'equipment:status-updated',
        payload: equipment,
        timestamp: new Date()
      });

      socket.emit('equipment:status-updated', { success: true, equipment });
    } catch (error) {
      logger.error('Error updating equipment status:', error);
      socket.emit('error', { message: 'Failed to update status', error });
    }
  }

  private async handleStudentCheckIn(socket: AuthenticatedSocket, data: any) {
    try {
      const { studentId, activityType } = data;

      const activity = await prisma.student_activities.create({
        data: {
          id: crypto.randomUUID(),
          student_id: studentId,
          activity_type: activityType || 'CHECK_IN',
          start_time: new Date(),
          status: 'ACTIVE',
          updated_at: new Date()
        },
        include: {
          students: true
        }
      });

      // Broadcast to activity room
      this.broadcastToRoom('activities', {
        type: 'student:checked-in',
        payload: activity,
        timestamp: new Date()
      });

      socket.emit('student:checked-in', { success: true, activity });
      logger.info(`Student checked in: ${studentId}`);
    } catch (error) {
      logger.error('Error checking in student:', error);
      socket.emit('error', { message: 'Failed to check in', error });
    }
  }

  private async handleStudentCheckOut(socket: AuthenticatedSocket, data: any) {
    try {
      const { activityId } = data;

      const activity = await prisma.student_activities.update({
        where: { id: activityId },
        data: {
          end_time: new Date(),
          status: 'COMPLETED'
        },
        include: {
          students: true
        }
      });

      // Broadcast to activity room
      this.broadcastToRoom('activities', {
        type: 'student:checked-out',
        payload: activity,
        timestamp: new Date()
      });

      socket.emit('student:checked-out', { success: true, activity });
      logger.info(`Student checked out: ${activity.student_id}`);
    } catch (error) {
      logger.error('Error checking out student:', error);
      socket.emit('error', { message: 'Failed to check out', error });
    }
  }

  private async handleScannerInput(socket: AuthenticatedSocket, data: any) {
    try {
      const { code, scannerType } = data;

      // Determine if it's a student ID or equipment ID
      let result: any = null;

      if (scannerType === 'student' || code.startsWith('STU')) {
        result = await prisma.students.findFirst({
          where: {
            OR: [
              { student_id: code }
            ]
          }
        });

        if (result) {
          this.broadcastToRoom('scanner', {
            type: 'scanner:student-detected',
            payload: result,
            timestamp: new Date()
          });
        }
      } else {
        result = await prisma.equipment.findFirst({
          where: {
            OR: [
              { equipment_id: code }
            ]
          }
        });

        if (result) {
          this.broadcastToRoom('scanner', {
            type: 'scanner:equipment-detected',
            payload: result,
            timestamp: new Date()
          });
        }
      }

      socket.emit('scanner:scan-result', { 
        success: !!result, 
        result,
        code 
      });
    } catch (error) {
      logger.error('Error processing scanner input:', error);
      socket.emit('error', { message: 'Failed to process scan', error });
    }
  }

  private async handleNotificationSend(socket: AuthenticatedSocket, data: any) {
    try {
      const { recipientId, title, message, type } = data;

      // Create notification in database
      const notification = await prisma.notifications.create({
        data: {
          id: crypto.randomUUID(),
          user_id: recipientId,
          title,
          message,
          type: type || 'INFO',
          updated_at: new Date()
        }
      });

      // Send to specific user if they're connected
      const recipientSocket = Array.from(this.connectedClients.values()).find(
        s => s.userId === recipientId
      );

      if (recipientSocket) {
        recipientSocket.emit('notification:received', {
          notification,
          timestamp: new Date()
        });
      }

      socket.emit('notification:sent', { success: true, notification });
    } catch (error) {
      logger.error('Error sending notification:', error);
      socket.emit('error', { message: 'Failed to send notification', error });
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket) {
    this.connectedClients.delete(socket.id);

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
    if (!this.io) return;
    this.io.to(room).emit('message', message);
  }

  public broadcastToAll(message: WebSocketMessage) {
    if (!this.io) return;
    this.io.emit('message', message);
  }

  public broadcastToUser(userId: string, message: WebSocketMessage) {
    const socket = Array.from(this.connectedClients.values()).find(
      s => s.userId === userId
    );
    if (socket) {
      socket.emit('message', message);
    }
  }

  public getConnectedClients(): number {
    return this.connectedClients.size;
  }

  public getRoomSubscribers(room: string): number {
    return this.roomSubscriptions.get(room)?.size || 0;
  }

  public isUserConnected(userId: string): boolean {
    return Array.from(this.connectedClients.values()).some(
      socket => socket.userId === userId
    );
  }

  public getStatus() {
    return {
      isInitialized: !!this.io,
      isRunning: !!this.io,
      stats: {
        totalConnections: this.connectedClients.size,
        connectionsByRole: this.getConnectionsByRole()
      }
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
