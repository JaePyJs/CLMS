/* eslint-disable @typescript-eslint/no-explicit-any */
// import { randomUUID } from 'crypto'; // Unused
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { isDevelopment, getAllowedOrigins, env } from '../config/env';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { scannerHandler } from './scannerHandler';

export interface AuthenticatedSocket {
  id: string;
  userId?: string;
  userRole?: string;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  disconnect: () => void;
  connected: boolean;
  handshake: any;
  join: (room: string) => void;
  leave: (room: string) => void;
}

interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
}

class WebSocketServer {
  private io: any = null;
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private roomSubscriptions: Map<string, Set<string>> = new Map();
  private rateLimits: Map<
    string,
    { sub: { c: number; r: number }; dash: { c: number; r: number } }
  > = new Map();
  private userConnections: Map<string, string> = new Map();
  private subscriptionDeniedLogs: Array<{
    socketId: string;
    room: string;
    userId?: string;
    role?: string;
    at: string;
  }> = [];
  private rateLimitLogs: Array<{
    socketId: string;
    kind: 'subscribe' | 'dashboard';
    count: number;
    userId?: string;
    role?: string;
    at: string;
  }> = [];

  initialize(httpServer: HTTPServer) {
    const allowedOrigins = getAllowedOrigins();
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (
          origin: string,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          logger.info(
            `[WebSocket] Checking origin: ${origin} (Dev Mode: ${isDevelopment()})`,
          );
          // Always allow in development or if no origin (e.g. mobile apps, curl)
          if (isDevelopment() || !origin) {
            callback(null, true);
            return;
          }

          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            // Log but allow for now to debug connection issues
            logger.warn(`WebSocket CORS warning for origin: ${origin}`);
            callback(null, true);
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    // Debug: Log engine events
    this.io.engine.on('connection_error', (err: any) => {
      logger.error('[WebSocket] Engine connection_error:', {
        message: err.message,
        code: err.code,
        context: err.context,
      });
    });

    this.io.engine.on('initial_headers', (_headers: any, req: any) => {
      logger.debug('[WebSocket] Engine initial_headers:', { url: req.url });
    });

    this.io.engine.on('connection', (rawSocket: any) => {
      logger.info(
        '[WebSocket] Engine-level connection established:',
        rawSocket.id,
      );
    });

    this.io!.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);
      logger.info(`DEBUG: Starting auth for ${socket.id}`);

      // Authenticate socket
      this.authenticateSocket(socket);
      logger.info(
        `DEBUG: Auth finished for ${socket.id}. UserId: ${socket.userId}, Connected: ${socket.connected}`,
      );

      this.connectedClients.set(socket.id, socket);
      if (socket.userId) {
        const prev = this.userConnections.get(socket.userId);
        if (prev && prev !== socket.id) {
          logger.info(
            `DEBUG: Disconnecting previous session ${prev} for user ${socket.userId}`,
          );
          const old = this.connectedClients.get(prev);
          try {
            old?.disconnect();
          } catch (e) {
            logger.warn('Failed to disconnect previous socket', {
              error: (e as Error)?.message || 'Unknown',
            });
          }
        }
        this.userConnections.set(socket.userId, socket.id);
      }

      // Handle events
      this.setupEventHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', reason => {
        logger.info(
          `WebSocket client disconnected: ${socket.id}, Reason: ${reason}`,
        );
        this.connectedClients.delete(socket.id);
        const uid = socket.userId;
        if (uid && this.userConnections.get(uid) === socket.id) {
          this.userConnections.delete(uid);
        }
        this.handleDisconnection(socket);
      });

      // Log handshake details for security auditing
      try {
        const hdr = socket.handshake?.headers || {};
        logger.info('WebSocket handshake', {
          socketId: socket.id,
          origin: hdr['origin'] || hdr['Referer'] || hdr['referer'] || null,
          userAgent: hdr['user-agent'] || null,
          userId: socket.userId || null,
          role: socket.userRole || null,
        });
      } catch (err) {
        logger.warn('WebSocket handshake log failed', err as any);
      }

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
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const clientDevBypass = socket.handshake.auth?.devBypass === true;
    const isDevBypass =
      isDevelopment() && (env.WS_DEV_BYPASS || clientDevBypass);

    // Check if this is a kiosk/public display connection (allows unauthenticated access to attendance room only)
    const isKioskMode =
      socket.handshake.auth?.kioskMode === true ||
      socket.handshake.query?.kioskMode === 'true';

    logger.debug(
      `[WebSocket Auth] Socket ${socket.id}: token=${!!token}, clientDevBypass=${clientDevBypass}, isDevBypass=${isDevBypass}, kioskMode=${isKioskMode}`,
    );

    if (token) {
      try {
        const decoded: any = jwt.verify(String(token), env.JWT_SECRET);
        const uid = decoded?.id || decoded?.userId;
        const role = decoded?.role;
        if (uid && role) {
          socket.userId = String(uid);
          socket.userRole = String(role);
          logger.info(
            `WebSocket authenticated: ${socket.id}, User: ${socket.userId}, Role: ${socket.userRole}`,
          );
          return;
        } else {
          logger.warn(
            `JWT payload missing id/userId or role for socket ${socket.id}`,
          );
        }
      } catch (error) {
        if (!isDevBypass && !isKioskMode) {
          logger.error(
            `WebSocket authentication failed for socket ${socket.id}:`,
            error,
          );
          socket.emit('error', { message: 'Invalid authentication token' });
          socket.disconnect();
          return;
        }
        logger.warn(
          `Token verification failed, falling back to dev bypass or kiosk mode for ${socket.id}`,
        );
      }
    }

    if (isDevBypass) {
      socket.userId = `dev-user-${socket.id}`;
      socket.userRole = 'developer';
      logger.warn(`WebSocket dev bypass: ${socket.id} connected (fallback)`);
      return;
    }

    // Allow kiosk mode connections without authentication (limited to attendance room)
    if (isKioskMode) {
      socket.userId = `kiosk-${socket.id}`;
      socket.userRole = 'kiosk';
      logger.info(
        `WebSocket kiosk mode: ${socket.id} connected (public display)`,
      );
      return;
    }

    logger.warn(
      `WebSocket authentication failed: No token for socket ${socket.id}`,
    );
    socket.emit('error', { message: 'Authentication token required' });
    socket.disconnect();
  }

  private setupEventHandlers(socket: AuthenticatedSocket) {
    const allowedRooms = new Set([
      'attendance',
      'dashboard',
      'equipment',
      'notifications',
      'activities',
      'scanner', // For scanner daemon connections
    ]);
    const canSubscribe = (room: string, role?: string) => {
      if (!allowedRooms.has(room)) {
        return false;
      }
      // Allow 'attendance' for all connections (including kiosk displays)
      if (room === 'attendance') {
        return true;
      }
      if (!role) {
        return false;
      }
      // Single-user system: all authenticated users can access all rooms
      if (role === 'developer' || role === 'LIBRARIAN' || role === 'ADMIN') {
        return true;
      }
      // Allow KIOSK_DISPLAY for attendance only
      if (room === 'attendance' && role === 'KIOSK_DISPLAY') {
        return true;
      }
      return role === 'LIBRARIAN';
    };
    socket.on('subscribe', (data: { subscription: string }) => {
      const now = Date.now();
      const rl = this.rateLimits.get(socket.id) || {
        sub: { c: 0, r: now + 60000 },
        dash: { c: 0, r: now + 60000 },
      };
      if (now > rl.sub.r) {
        rl.sub = { c: 0, r: now + 60000 };
      }
      rl.sub.c += 1;
      this.rateLimits.set(socket.id, rl);
      if (rl.sub.c > 10) {
        socket.emit('error', {
          message: 'Rate limit exceeded',
          subscription: String(data?.subscription || ''),
        });
        this.rateLimitLogs.push({
          socketId: socket.id,
          kind: 'subscribe',
          count: rl.sub.c,
          userId: socket.userId,
          role: socket.userRole,
          at: new Date().toISOString(),
        });
        if (this.rateLimitLogs.length > 50) {
          this.rateLimitLogs.shift();
        }
        return;
      }
      const room = String(data?.subscription || '').trim();
      if (!room || !canSubscribe(room, socket.userRole)) {
        socket.emit('error', {
          message: 'Subscription denied',
          subscription: room,
        });
        this.subscriptionDeniedLogs.push({
          socketId: socket.id,
          room,
          userId: socket.userId,
          role: socket.userRole,
          at: new Date().toISOString(),
        });
        if (this.subscriptionDeniedLogs.length > 50) {
          this.subscriptionDeniedLogs.shift();
        }
        return;
      }
      void socket.join(room);
      const subscribers = this.roomSubscriptions.get(room) || new Set();
      subscribers.add(socket.id);
      this.roomSubscriptions.set(room, subscribers);
      socket.emit('subscription_confirmed', {
        subscription: room,
        timestamp: new Date(),
      });
      logger.info(`Socket ${socket.id} subscribed to ${room}`);
    });

    // Unsubscribe from channels
    socket.on('unsubscribe', (data: { subscription: string }) => {
      const room = String(data?.subscription || '').trim();
      if (!room || !allowedRooms.has(room)) {
        return;
      }
      void socket.leave(room);
      const subscribers = this.roomSubscriptions.get(room);
      if (subscribers) {
        subscribers.delete(socket.id);
      }
      socket.emit('unsubscribed', {
        subscription: room,
        timestamp: new Date(),
      });
      logger.info(`Socket ${socket.id} unsubscribed from ${room}`);
    });

    // Handle ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Handle barcode scans from scanner daemons (PC1, PC2)
    socket.on(
      'barcode:scanned',
      (data: { barcode: string; timestamp: number; pcId: string }) => {
        void (async () => {
          try {
            logger.info('WebSocket: Received barcode:scanned event', {
              socketId: socket.id,
              barcode: data.barcode,
              pcId: data.pcId,
            });

            const result = await scannerHandler.handleBarcodeScan(data);

            // Send result back to the scanner daemon
            socket.emit('scan:result', result);

            logger.info('WebSocket: Barcode scan processed', {
              socketId: socket.id,
              success: result.success,
              type: result.type,
              action: result.action,
            });
          } catch (error) {
            logger.error('WebSocket: Error processing barcode scan', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            socket.emit('scan:result', {
              success: false,
              type: 'unknown',
              message: 'Failed to process scan',
            });
          }
        })();
      },
    );

    // Handle dashboard data requests
    socket.on(
      'dashboard_request',
      (data: { dataType: string; filters?: any }) => {
        void (async () => {
          try {
            const now = Date.now();
            const rl = this.rateLimits.get(socket.id) || {
              sub: { c: 0, r: now + 60000 },
              dash: { c: 0, r: now + 60000 },
            };
            if (now > rl.dash.r) {
              rl.dash = { c: 0, r: now + 60000 };
            }
            rl.dash.c += 1;
            this.rateLimits.set(socket.id, rl);
            if (rl.dash.c > 20) {
              socket.emit('error', {
                message: 'Rate limit exceeded',
                request: String(data?.dataType || ''),
              });
              this.rateLimitLogs.push({
                socketId: socket.id,
                kind: 'dashboard',
                count: rl.dash.c,
                userId: socket.userId,
                role: socket.userRole,
                at: new Date().toISOString(),
              });
              if (this.rateLimitLogs.length > 50) {
                this.rateLimitLogs.shift();
              }
              return;
            }
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const studentCount = await prisma.students.count();
            logger.info(
              `[WebSocket] Dashboard stats - Total Students: ${studentCount}`,
            );

            const overviewData = {
              totalStudents: studentCount,
              activeStudents: await prisma.student_activities.count({
                where: { status: 'ACTIVE' },
              }),
              totalBooks: await prisma.books.count(),
              activeBorrows: await prisma.book_checkouts.count({
                where: { status: 'ACTIVE' },
              }),
              overdueBorrows: await prisma.book_checkouts.count({
                where: {
                  status: 'ACTIVE',
                  due_date: { lt: new Date() },
                },
              }),
              todayActivities: await prisma.student_activities.count({
                where: {
                  start_time: { gte: startOfDay },
                },
              }),
              activeEquipment: await prisma.equipment.count({
                where: { status: 'IN_USE' },
              }),
              activeConnections: this.connectedClients.size,
              systemLoad: Math.floor(Math.random() * 20) + 1, // Simulated load 1-20%
            };

            let responseData;
            if (data.dataType === 'overview') {
              responseData = overviewData;
            } else if (data.dataType === 'activities') {
              const activities = await prisma.student_activities.findMany({
                take: 10,
                orderBy: { start_time: 'desc' },
                include: { student: true },
              });
              responseData = activities.map(a => {
                let gradeDisplay = '';
                if (
                  a.student?.grade_level !== undefined &&
                  a.student?.grade_level !== null
                ) {
                  if (a.student.grade_level === 0) {
                    gradeDisplay = 'Pre-School';
                  } else {
                    gradeDisplay = `Grade ${a.student.grade_level}`;
                  }
                }
                return {
                  id: a.id,
                  studentName: a.student
                    ? `${a.student.first_name} ${a.student.last_name}`
                    : 'Unknown',
                  activityType: a.activity_type,
                  timestamp: a.start_time,
                  studentId: a.student_id,
                  gradeLevel: gradeDisplay,
                };
              });
            } else if (data.dataType === 'equipment') {
              const equipment = await prisma.equipment.findMany({
                where: { status: 'IN_USE' },
              });
              responseData = equipment.reduce((acc, curr) => {
                acc[curr.id] = curr;
                return acc;
              }, {} as any);
            } else {
              responseData = { overview: overviewData };
            }

            socket.emit('dashboard_data', {
              dataType: data.dataType,
              data: responseData,
              timestamp: new Date(),
            });
          } catch (error) {
            logger.error('Error handling dashboard request:', error);
            socket.emit('error', { message: 'Failed to fetch dashboard data' });
          }
        })();
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
    gradeLevel?: string;
    gender?: string;
    checkinTime: string;
    autoLogoutAt: string;
    reminders?: any[];
    customMessage?: string;
  }) {
    if (!this.io) {
      logger.warn(
        'WebSocket server not initialized, cannot emit check-in event',
      );
      return;
    }

    const now = new Date();
    const legacy: WebSocketMessage = {
      id: data.activityId,
      type: 'student_checkin',
      data,
      timestamp: now,
    };
    const modern: WebSocketMessage = {
      id: data.activityId,
      type: 'attendance:checkin',
      data,
      timestamp: now,
    };

    // Debug: log room info before emitting
    const roomSockets = this.io?.sockets?.adapter?.rooms?.get('attendance');
    logger.info('DEBUG: About to emit to attendance room', {
      activityId: data.activityId,
      roomSubscribersFromMap:
        this.roomSubscriptions.get('attendance')?.size || 0,
      actualRoomSize: roomSockets?.size || 0,
      roomSocketIds: roomSockets ? Array.from(roomSockets) : [],
    });

    this.io.to('attendance').emit('message', legacy);
    this.io.to('attendance').emit('message', modern);

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
    gradeLevel?: string;
    gender?: string;
    checkoutTime: string;
    reason: 'manual' | 'auto';
    customMessage?: string;
  }) {
    if (!this.io) {
      logger.warn(
        'WebSocket server not initialized, cannot emit check-out event',
      );
      return;
    }

    const now = new Date();
    const legacy: WebSocketMessage = {
      id: data.activityId,
      type: 'student_checkout',
      data,
      timestamp: now,
    };
    const modern: WebSocketMessage = {
      id: data.activityId,
      type: 'attendance:checkout',
      data,
      timestamp: now,
    };
    this.io.to('attendance').emit('message', legacy);
    this.io.to('attendance').emit('message', modern);

    logger.info('Student check-out event emitted', {
      activityId: data.activityId,
      studentId: data.studentId,
      subscriberCount: this.roomSubscriptions.get('attendance')?.size || 0,
    });
  }

  /**
   * Emit student cooldown event to attendance channel (for Kiosk display feedback)
   */
  public emitStudentCooldown(data: {
    studentId: string;
    studentName: string;
    cooldownRemaining: number;
    message: string;
  }) {
    if (!this.io) {
      logger.warn(
        'WebSocket server not initialized, cannot emit cooldown event',
      );
      return;
    }

    const now = new Date();
    const message: WebSocketMessage = {
      id: `cooldown-${data.studentId}-${Date.now()}`,
      type: 'student_cooldown',
      data,
      timestamp: now,
    };

    this.io.to('attendance').emit('message', message);

    logger.info('Student cooldown event emitted', {
      studentId: data.studentId,
      cooldownRemaining: data.cooldownRemaining,
      subscriberCount: this.roomSubscriptions.get('attendance')?.size || 0,
    });
  }

  /**
   * Emit student moved event to attendance channel
   */
  public emitStudentMoved(data: { activityId: string; section: string }) {
    if (!this.io) {
      logger.warn(
        'WebSocket server not initialized, cannot emit student moved event',
      );
      return;
    }

    const now = new Date();
    const message: WebSocketMessage = {
      id: data.activityId,
      type: 'student_moved',
      data,
      timestamp: now,
    };

    this.io.to('attendance').emit('message', message);
    this.io.to('dashboard').emit('message', message);

    logger.info('Student moved event emitted', {
      activityId: data.activityId,
      section: data.section,
    });
  }

  public emitSectionChange(data: {
    studentId: string;
    studentName: string;
    from?: string[];
    to: string[];
    at: string;
  }) {
    if (!this.io) {
      logger.warn(
        'WebSocket server not initialized, cannot emit section change',
      );
      return;
    }
    const now = new Date();
    const legacy: WebSocketMessage = {
      id: `${data.studentId}-${data.at}`,
      type: 'attendance_section_change',
      data,
      timestamp: now,
    };
    const modern: WebSocketMessage = {
      id: `${data.studentId}-${data.at}`,
      type: 'attendance:section-change',
      data,
      timestamp: now,
    };
    this.io.to('attendance').emit('message', legacy);
    this.io.to('attendance').emit('message', modern);
  }

  public emitOccupancyUpdate(counts: {
    AVR: number;
    COMPUTER: number;
    LIBRARY_SPACE: number;
    BORROWING: number;
    RECREATION: number;
  }) {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit occupancy');
      return;
    }
    const message: WebSocketMessage = {
      id: `occupancy-${Date.now()}`,
      type: 'attendance_occupancy',
      data: { counts },
      timestamp: new Date(),
    };
    this.io.to('attendance').emit('message', message);
  }

  public emitBorrowReturnUpdate(data: {
    type: 'checkout' | 'return';
    studentId: string;
    bookId: string;
    dueDate: string;
    fineAmount: number;
    status: 'ACTIVE' | 'RETURNED';
  }) {
    if (!this.io) {
      logger.warn(
        'WebSocket server not initialized, cannot emit borrow/return update',
      );
      return;
    }
    const message: WebSocketMessage = {
      id: `${data.studentId}-${data.bookId}-${Date.now()}`,
      type: 'borrow_return_update',
      data,
      timestamp: new Date(),
    };
    this.io.to('attendance').emit('message', message);
  }

  public emitReadingSession(data: {
    studentId: string;
    bookId: string;
    bookTitle: string;
    startTime: string;
  }) {
    if (!this.io) {
      logger.warn(
        'WebSocket server not initialized, cannot emit reading session',
      );
      return;
    }
    const message: WebSocketMessage = {
      id: `${data.studentId}-${data.bookId}-${Date.now()}`,
      type: 'reading_session',
      data,
      timestamp: new Date(),
    };
    this.io.to('attendance').emit('message', message);
  }

  public getStats() {
    return {
      totalConnections: this.connectedClients.size,
      connectionsByRole: this.getConnectionsByRole(),
      recentSubscriptionDenials: this.subscriptionDeniedLogs.slice(-10),
      recentRateLimits: this.rateLimitLogs.slice(-10),
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
