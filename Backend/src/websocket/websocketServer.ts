import { randomUUID } from 'crypto';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import {
  PrismaClient,
  equipment_status,
  equipment_sessions_status,
  student_activities_activity_type,
  student_activities_status,
  notifications_type,
  type equipment,
  type students,
} from '@prisma/client';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notification.service';
const prisma = new PrismaClient();

type EquipmentStatusValue =
  (typeof equipment_status)[keyof typeof equipment_status];
type StudentActivityTypeValue =
  (typeof student_activities_activity_type)[keyof typeof student_activities_activity_type];
type NotificationTypeValue =
  (typeof notifications_type)[keyof typeof notifications_type];

const EQUIPMENT_STATUS_VALUES = new Set<EquipmentStatusValue>(
  Object.values(equipment_status),
);
const STUDENT_ACTIVITY_TYPE_VALUES = new Set<StudentActivityTypeValue>(
  Object.values(student_activities_activity_type),
);
const NOTIFICATION_TYPE_VALUES = new Set<NotificationTypeValue>(
  Object.values(notifications_type),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (
  obj: Record<string, unknown>,
  key: string,
): string | null => {
  const value = obj[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const getNumber = (
  obj: Record<string, unknown>,
  key: string,
): number | null => {
  const value = obj[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isEnumValue = <T extends string>(
  value: unknown,
  allowed: Set<T>,
): value is T => typeof value === 'string' && allowed.has(value as T);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type EquipmentSessionStartPayload = {
  equipmentId: string;
  studentId: string;
  timeLimitMinutes: number;
};

type EquipmentSessionEndPayload = {
  sessionId: string;
};

type EquipmentStatusUpdatePayload = {
  equipmentId: string;
  status: EquipmentStatusValue;
};

type StudentCheckInPayload = {
  studentId: string;
  activityType?: StudentActivityTypeValue;
};

type StudentCheckOutPayload = {
  activityId: string;
};

type ScannerScanPayload = {
  code: string;
  scannerType?: 'student' | 'equipment';
};

type NotificationSendPayload = {
  recipientId: string;
  title: string;
  message: string;
  type?: NotificationTypeValue;
};

type UpdatePreferencesPayload = Record<string, unknown>;

const parseEquipmentSessionStartPayload = (
  data: unknown,
): EquipmentSessionStartPayload | null => {
  if (!isRecord(data)) return null;

  const equipmentId = getString(data, 'equipmentId');
  const studentId = getString(data, 'studentId');
  const timeLimitMinutes = getNumber(data, 'timeLimitMinutes');

  if (!equipmentId || !studentId || timeLimitMinutes === null) {
    return null;
  }

  return { equipmentId, studentId, timeLimitMinutes };
};

const parseEquipmentSessionEndPayload = (
  data: unknown,
): EquipmentSessionEndPayload | null => {
  if (!isRecord(data)) return null;
  const sessionId = getString(data, 'sessionId');
  return sessionId ? { sessionId } : null;
};

const parseEquipmentStatusUpdatePayload = (
  data: unknown,
): EquipmentStatusUpdatePayload | null => {
  if (!isRecord(data)) return null;

  const equipmentId = getString(data, 'equipmentId');
  const statusValue = data['status'];

  if (!equipmentId || !isEnumValue(statusValue, EQUIPMENT_STATUS_VALUES)) {
    return null;
  }

  return { equipmentId, status: statusValue };
};

const parseStudentCheckInPayload = (
  data: unknown,
): StudentCheckInPayload | null => {
  if (!isRecord(data)) return null;

  const studentId = getString(data, 'studentId');
  if (!studentId) {
    return null;
  }

  const activityTypeValue = data['activityType'];
  const activityType = isEnumValue(
    activityTypeValue,
    STUDENT_ACTIVITY_TYPE_VALUES,
  )
    ? activityTypeValue
    : undefined;

  const payload: StudentCheckInPayload = { studentId };

  if (activityType) {
    payload.activityType = activityType;
  }

  return payload;
};

const parseStudentCheckOutPayload = (
  data: unknown,
): StudentCheckOutPayload | null => {
  if (!isRecord(data)) return null;
  const activityId = getString(data, 'activityId');
  return activityId ? { activityId } : null;
};

const parseScannerScanPayload = (data: unknown): ScannerScanPayload | null => {
  if (!isRecord(data)) return null;

  const code = getString(data, 'code');
  if (!code) {
    return null;
  }

  const scannerTypeValue = getString(data, 'scannerType');
  const scannerType =
    scannerTypeValue === 'student' || scannerTypeValue === 'equipment'
      ? scannerTypeValue
      : undefined;

  const payload: ScannerScanPayload = { code };

  if (scannerType) {
    payload.scannerType = scannerType;
  }

  return payload;
};

const parseNotificationSendPayload = (
  data: unknown,
): NotificationSendPayload | null => {
  if (!isRecord(data)) return null;

  const recipientId = getString(data, 'recipientId');
  const title = getString(data, 'title');
  const message = getString(data, 'message');

  if (!recipientId || !title || !message) {
    return null;
  }

  const typeValue = data['type'];
  const type = isEnumValue(typeValue, NOTIFICATION_TYPE_VALUES)
    ? typeValue
    : undefined;

  const payload: NotificationSendPayload = { recipientId, title, message };

  if (type) {
    payload.type = type;
  }

  return payload;
};

const parseUpdatePreferencesPayload = (
  data: unknown,
): UpdatePreferencesPayload | null => (isRecord(data) ? data : null);

const resolveUserIdFromToken = (
  decoded: string | JwtPayload,
): string | null => {
  if (typeof decoded === 'string') {
    return null;
  }

  const candidate = decoded?.userId;
  return typeof candidate === 'string' ? candidate : null;
};

const emitValidationError = (socket: AuthenticatedSocket, message: string) => {
  socket.emit('error', { message });
};

const ensureAuthenticatedUserId = (
  socket: AuthenticatedSocket,
  errorMessage: string,
): string | null => {
  if (!socket.userId) {
    emitValidationError(socket, errorMessage);
    return null;
  }

  return socket.userId;
};

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  username?: string;
}

interface WebSocketMessage {
  type: string;
  payload: unknown;
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
        methods: ['GET', 'POST'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'your-secret-key',
        );

        const userId = resolveUserIdFromToken(decoded);
        if (!userId) {
          return next(new Error('Invalid token payload'));
        }

        // Verify user exists
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { id: true, username: true, role: true },
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.username = user.username;

        next();
      } catch (error) {
        logger.error('WebSocket authentication error', {
          error: getErrorMessage(error),
        });
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
        timestamp: new Date(),
      });

      // Room subscription handlers
      socket.on('subscribe', (room: string) => {
        this.subscribeToRoom(socket, room);
      });

      socket.on('unsubscribe', (room: string) => {
        this.unsubscribeFromRoom(socket, room);
      });

      // Equipment events
      socket.on('equipment:start-session', async data => {
        await this.handleEquipmentSessionStart(socket, data);
      });

      socket.on('equipment:end-session', async data => {
        await this.handleEquipmentSessionEnd(socket, data);
      });

      socket.on('equipment:status-update', async data => {
        await this.handleEquipmentStatusUpdate(socket, data);
      });

      // Student activity events
      socket.on('student:check-in', async data => {
        await this.handleStudentCheckIn(socket, data);
      });

      socket.on('student:check-out', async data => {
        await this.handleStudentCheckOut(socket, data);
      });

      // Scanner events
      socket.on('scanner:scan', async data => {
        await this.handleScannerInput(socket, data);
      });

      // Notification events
      socket.on('notification:send', async data => {
        await this.handleNotificationSend(socket, data);
      });

      // Subscribe to notifications
      socket.on('notification:subscribe', () => {
        this.subscribeToNotifications(socket);
      });

      // Unsubscribe from notifications
      socket.on('notification:unsubscribe', () => {
        this.unsubscribeFromNotifications(socket);
      });

      // Mark notification as read
      socket.on('notification:mark-read', async data => {
        await this.handleMarkNotificationRead(socket, data);
      });

      // Get notification preferences
      socket.on('notification:get-preferences', async () => {
        await this.handleGetNotificationPreferences(socket);
      });

      // Update notification preferences
      socket.on('notification:update-preferences', async data => {
        await this.handleUpdateNotificationPreferences(socket, data);
      });

      // Ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });

      // Disconnection
      socket.on('disconnect', reason => {
        logger.info(`Client disconnected: ${socket.id} (Reason: ${reason})`);
        this.handleDisconnection(socket);
      });

      // Error handling
      socket.on('error', error => {
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

  private async handleEquipmentSessionStart(
    socket: AuthenticatedSocket,
    data: unknown,
  ) {
    try {
      const payload = parseEquipmentSessionStartPayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid equipment session start payload');
        logger.warn('Invalid equipment session start payload received', {
          data,
        });
        return;
      }

      const plannedEnd =
        payload.timeLimitMinutes > 0
          ? new Date(Date.now() + payload.timeLimitMinutes * 60 * 1000)
          : null;

      const session = await prisma.equipment_sessions.create({
        data: {
          id: randomUUID(),
          equipment_id: payload.equipmentId,
          student_id: payload.studentId,
          session_start: new Date(),
          planned_end: plannedEnd,
          status: equipment_sessions_status.ACTIVE,
          updated_at: new Date(),
        },
        include: {
          equipment: {
            select: {
              id: true,
              equipment_id: true,
              name: true,
              type: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Broadcast to equipment room
      this.broadcastToRoom('equipment', {
        type: 'session:started',
        payload: session,
        timestamp: new Date(),
      });

      // Broadcast to student room
      this.broadcastToRoom(`student:${payload.studentId}`, {
        type: 'equipment:session-started',
        payload: session,
        timestamp: new Date(),
      });

      socket.emit('equipment:session-started', { success: true, session });
      logger.info(`Equipment session started: ${session.id}`);
    } catch (error) {
      logger.error('Error starting equipment session', {
        error: getErrorMessage(error),
      });
      emitValidationError(socket, 'Failed to start session');
    }
  }

  private async handleEquipmentSessionEnd(
    socket: AuthenticatedSocket,
    data: unknown,
  ) {
    try {
      const payload = parseEquipmentSessionEndPayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid equipment session end payload');
        logger.warn('Invalid equipment session end payload received', { data });
        return;
      }

      const session = await prisma.equipment_sessions.update({
        where: { id: payload.sessionId },
        data: {
          session_end: new Date(),
          status: equipment_sessions_status.COMPLETED,
        },
        include: {
          equipment: {
            select: {
              id: true,
              equipment_id: true,
              name: true,
              type: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Broadcast to equipment room
      this.broadcastToRoom('equipment', {
        type: 'session:ended',
        payload: session,
        timestamp: new Date(),
      });

      socket.emit('equipment:session-ended', { success: true, session });
      logger.info(`Equipment session ended: ${session.id}`);
    } catch (error) {
      logger.error('Error ending equipment session', {
        error: getErrorMessage(error),
      });
      emitValidationError(socket, 'Failed to end session');
    }
  }

  private async handleEquipmentStatusUpdate(
    socket: AuthenticatedSocket,
    data: unknown,
  ) {
    try {
      const payload = parseEquipmentStatusUpdatePayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid equipment status payload');
        logger.warn('Invalid equipment status payload received', { data });
        return;
      }

      const equipment = await prisma.equipment.update({
        where: { id: payload.equipmentId },
        data: { status: payload.status },
      });

      // Broadcast to all equipment subscribers
      this.broadcastToRoom('equipment', {
        type: 'equipment:status-updated',
        payload: equipment,
        timestamp: new Date(),
      });

      socket.emit('equipment:status-updated', { success: true, equipment });
    } catch (error) {
      logger.error('Error updating equipment status', {
        error: getErrorMessage(error),
      });
      emitValidationError(socket, 'Failed to update status');
    }
  }

  private async handleStudentCheckIn(
    socket: AuthenticatedSocket,
    data: unknown,
  ) {
    try {
      const payload = parseStudentCheckInPayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid student check-in payload');
        logger.warn('Invalid student check-in payload received', { data });
        return;
      }

      const activity = await prisma.student_activities.create({
        data: {
          id: randomUUID(),
          student_id: payload.studentId,
          activity_type:
            payload.activityType ??
            student_activities_activity_type.GENERAL_VISIT,
          start_time: new Date(),
          status: student_activities_status.ACTIVE,
          updated_at: new Date(),
        },
        include: {
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Broadcast to activity room
      this.broadcastToRoom('activities', {
        type: 'student:checked-in',
        payload: activity,
        timestamp: new Date(),
      });

      socket.emit('student:checked-in', { success: true, activity });
      logger.info(`Student checked in: ${payload.studentId}`);
    } catch (error) {
      logger.error('Error checking in student', {
        error: getErrorMessage(error),
      });
      emitValidationError(socket, 'Failed to check in');
    }
  }

  private async handleStudentCheckOut(
    socket: AuthenticatedSocket,
    data: unknown,
  ) {
    try {
      const payload = parseStudentCheckOutPayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid student check-out payload');
        logger.warn('Invalid student check-out payload received', { data });
        return;
      }

      const activity = await prisma.student_activities.update({
        where: { id: payload.activityId },
        data: {
          end_time: new Date(),
          status: student_activities_status.COMPLETED,
          updated_at: new Date(),
        },
        include: {
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Broadcast to activity room
      this.broadcastToRoom('activities', {
        type: 'student:checked-out',
        payload: activity,
        timestamp: new Date(),
      });

      socket.emit('student:checked-out', { success: true, activity });
      logger.info(`Student checked out: ${activity.student_id}`);
    } catch (error) {
      logger.error('Error checking out student', {
        error: getErrorMessage(error),
      });
      emitValidationError(socket, 'Failed to check out');
    }
  }

  private async handleScannerInput(socket: AuthenticatedSocket, data: unknown) {
    try {
      const payload = parseScannerScanPayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid scanner input payload');
        logger.warn('Invalid scanner input payload received', { data });
        return;
      }

      const { code } = payload;
      const scannerType =
        payload.scannerType ||
        (code.startsWith('STU') ? 'student' : 'equipment');

      let result: students | equipment | null = null;

      if (scannerType === 'student') {
        result = await prisma.students.findFirst({
          where: { student_id: code },
        });

        if (result) {
          this.broadcastToRoom('scanner', {
            type: 'scanner:student-detected',
            payload: result,
            timestamp: new Date(),
          });
        }
      } else {
        result = await prisma.equipment.findFirst({
          where: { equipment_id: code },
        });

        if (result) {
          this.broadcastToRoom('scanner', {
            type: 'scanner:equipment-detected',
            payload: result,
            timestamp: new Date(),
          });
        }
      }

      socket.emit('scanner:scan-result', {
        success: result !== null,
        result,
        code,
      });
    } catch (error) {
      logger.error('Error processing scanner input', {
        error: getErrorMessage(error),
      });
      emitValidationError(socket, 'Failed to process scan');
    }
  }

  private async handleNotificationSend(
    socket: AuthenticatedSocket,
    data: unknown,
  ) {
    try {
      const payload = parseNotificationSendPayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid notification payload');
        logger.warn('Invalid notification payload received', { data });
        return;
      }

      const notification = await prisma.notifications.create({
        data: {
          id: randomUUID(),
          user_id: payload.recipientId,
          title: payload.title,
          message: payload.message,
          type: payload.type ?? notifications_type.INFO,
        },
      });

      const recipientSocket = Array.from(this.connectedClients.values()).find(
        s => s.userId === payload.recipientId,
      );

      if (recipientSocket) {
        recipientSocket.emit('notification:received', {
          notification,
          timestamp: new Date(),
        });
      }

      socket.emit('notification:sent', { success: true, notification });
    } catch (error) {
      logger.error('Error sending notification', {
        error: getErrorMessage(error),
      });
      emitValidationError(socket, 'Failed to send notification');
    }
  }

  // Notification-related handlers
  private subscribeToNotifications(socket: AuthenticatedSocket) {
    socket.join(`notifications:${socket.userId}`);
    socket.emit('notification:subscribed', { timestamp: new Date() });
    logger.debug(`User ${socket.userId} subscribed to notifications`);
  }

  private unsubscribeFromNotifications(socket: AuthenticatedSocket) {
    socket.leave(`notifications:${socket.userId}`);
    socket.emit('notification:unsubscribed', { timestamp: new Date() });
    logger.debug(`User ${socket.userId} unsubscribed from notifications`);
  }

  private async handleMarkNotificationRead(
    socket: AuthenticatedSocket,
    data: { notificationId: string },
  ) {
    try {
      const { notificationId } = data;
      const userId = ensureAuthenticatedUserId(
        socket,
        'User not authenticated for notification access',
      );
      if (!userId) {
        return;
      }

      // Verify user owns the notification
      const notification = await prisma.notifications.findFirst({
        where: {
          id: notificationId,
          user_id: userId,
        },
      });

      if (!notification) {
        socket.emit('error', {
          message: 'Notification not found or access denied',
        });
        return;
      }

      await notificationService.markAsRead(notificationId);

      socket.emit('notification:marked-read', {
        notificationId,
        timestamp: new Date(),
      });

      logger.info(`Notification marked as read`, {
        notificationId,
        userId: socket.userId,
      });
    } catch (error) {
      logger.error('Error marking notification as read', {
        error,
        notificationId: data.notificationId,
      });
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  }

  private async handleGetNotificationPreferences(socket: AuthenticatedSocket) {
    try {
      const preferences =
        await notificationService.getUserNotificationPreferences(
          socket.userId!,
        );

      socket.emit('notification:preferences', {
        preferences,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error getting notification preferences', {
        error,
        userId: socket.userId,
      });
      socket.emit('error', {
        message: 'Failed to get notification preferences',
      });
    }
  }

  private async handleUpdateNotificationPreferences(
    socket: AuthenticatedSocket,
    data: unknown,
  ) {
    try {
      const userId = ensureAuthenticatedUserId(
        socket,
        'User not authenticated for updating notification preferences',
      );
      if (!userId) {
        return;
      }

      const payload = parseUpdatePreferencesPayload(data);
      if (!payload) {
        emitValidationError(socket, 'Invalid notification preferences payload');
        logger.warn('Invalid notification preference payload received', {
          data,
        });
        return;
      }

      const updatedPreferences =
        await notificationService.updateUserNotificationPreferences(
          userId,
          payload,
        );

      socket.emit('notification:preferences-updated', {
        preferences: updatedPreferences,
        timestamp: new Date(),
      });

      logger.info('Notification preferences updated via WebSocket', {
        userId,
        preferences: payload,
      });
    } catch (error) {
      logger.error('Error updating notification preferences', {
        error,
        userId: socket.userId,
      });
      socket.emit('error', {
        message: 'Failed to update notification preferences',
      });
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
      s => s.userId === userId,
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
      socket => socket.userId === userId,
    );
  }

  public getStatus() {
    return {
      isInitialized: !!this.io,
      isRunning: !!this.io,
      stats: {
        totalConnections: this.connectedClients.size,
        connectionsByRole: this.getConnectionsByRole(),
      },
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
