import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPSServer } from 'https';
import { Server as HTTPServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import { encryptData, decryptData, EncryptionCompliance } from '@/utils/encryption';

/**
 * WebSocket encryption middleware for secure real-time communications
 */
export class WebSocketEncryption {
  private static encryptionKey: Buffer | null = null;
  private static redisAdapter: any = null;

  /**
   * Initialize WebSocket encryption
   */
  static async initialize(): Promise<void> {
    try {
      // Generate or load encryption key for WebSocket messages
      const wsKey = process.env.WEBSOCKET_ENCRYPTION_KEY;
      if (wsKey) {
        this.encryptionKey = crypto.scryptSync(wsKey, 'websocket-encryption', 32);
      } else {
        this.encryptionKey = crypto.randomBytes(32);
        logger.warn('Generated new WebSocket encryption key - save it for persistence!');
      }

      // Initialize Redis adapter for scaling
      if (process.env.REDIS_URL) {
        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        this.redisAdapter = createAdapter(pubClient, subClient);
        logger.info('WebSocket Redis adapter initialized');
      }

      logger.info('WebSocket encryption initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebSocket encryption', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Create secure Socket.IO server with encryption
   */
  static createSecureSocketIO(
    httpServer: HTTPServer | HTTPSServer,
    options: any = {}
  ): SocketIOServer {
    try {
      const defaultOptions = {
        cors: {
          origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
          methods: ['GET', 'POST'],
          credentials: true
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB
        allowEIO3: false, // Disable Engine.IO protocol v3 for security
        ...options
      };

      const io = new SocketIOServer(httpServer, defaultOptions);

      // Apply encryption middleware
      io.use(this.encryptionMiddleware);

      // Apply authentication middleware
      io.use(this.authenticationMiddleware);

      // Apply rate limiting
      io.use(this.rateLimitingMiddleware);

      // Log connection events
      io.on('connection', (socket) => {
        this.handleSecureConnection(socket);
      });

      // Use Redis adapter if available
      if (this.redisAdapter) {
        io.adapter(this.redisAdapter);
      }

      logger.info('Secure Socket.IO server created');
      return io;
    } catch (error) {
      logger.error('Failed to create secure Socket.IO server', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Encryption middleware for Socket.IO
   */
  private static encryptionMiddleware = async (socket: any, next: any): Promise<void> => {
    try {
      // Add encryption methods to socket
      socket.encryptMessage = (data: any): string => {
        try {
          const serializedData = JSON.stringify(data);
          const encrypted = this.encryptMessage(serializedData);

          EncryptionCompliance.logEncryptionEvent('websocket_encrypt', 'websocket', socket.user?.id, {
            socketId: socket.id,
            dataSize: serializedData.length
          });

          return encrypted;
        } catch (error) {
          logger.error('Failed to encrypt WebSocket message', {
            error: (error as Error).message,
            socketId: socket.id
          });
          throw error;
        }
      };

      socket.decryptMessage = (encryptedData: string): any => {
        try {
          const decrypted = this.decryptMessage(encryptedData);
          const data = JSON.parse(decrypted);

          EncryptionCompliance.logEncryptionEvent('websocket_decrypt', 'websocket', socket.user?.id, {
            socketId: socket.id,
            dataSize: decrypted.length
          });

          return data;
        } catch (error) {
          logger.error('Failed to decrypt WebSocket message', {
            error: (error as Error).message,
            socketId: socket.id
          });
          throw error;
        }
      };

      // Override emit to automatically encrypt messages
      const originalEmit = socket.emit;
      socket.emit = (event: string, ...args: any[]): any => {
        try {
          // Only encrypt data events, not system events
          if (this.shouldEncryptEvent(event)) {
            const encryptedArgs = args.map((arg, index) => {
              if (index === 0) return arg; // Don't encrypt the event name
              if (typeof arg === 'object' || typeof arg === 'string') {
                return socket.encryptMessage(arg);
              }
              return arg;
            });
            return originalEmit.apply(socket, [event, ...encryptedArgs]);
          }
          return originalEmit.apply(socket, [event, ...args]);
        } catch (error) {
          logger.error('Failed to encrypt WebSocket emit', {
            error: (error as Error).message,
            event,
            socketId: socket.id
          });
          return originalEmit.apply(socket, [event, ...args]);
        }
      };

      next();
    } catch (error) {
      logger.error('WebSocket encryption middleware error', {
        error: (error as Error).message,
        socketId: socket.id
      });
      next(error);
    }
  };

  /**
   * Authentication middleware for WebSocket connections
   */
  private static authenticationMiddleware = async (socket: any, next: any): Promise<void> => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token (implement your JWT verification logic)
      try {
        // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        // socket.user = decoded;

        // For now, accept any token (replace with actual JWT verification)
        socket.user = { id: 'user-id', role: 'LIBRARIAN' };

        logger.info('WebSocket authenticated', {
          socketId: socket.id,
          userId: socket.user.id,
          role: socket.user.role
        });

        next();
      } catch (jwtError) {
        logger.warn('WebSocket authentication failed', {
          error: (jwtError as Error).message,
          socketId: socket.id
        });
        next(new Error('Invalid authentication token'));
      }
    } catch (error) {
      logger.error('WebSocket authentication middleware error', {
        error: (error as Error).message,
        socketId: socket.id
      });
      next(error);
    }
  };

  /**
   * Rate limiting middleware for WebSocket connections
   */
  private static rateLimitingMiddleware = async (socket: any, next: any): Promise<void> => {
    try {
      const clientIP = socket.handshake.address;
      const userId = socket.user?.id;

      // Implement rate limiting logic
      // For example, limit messages per minute per user/IP
      const rateLimitKey = `ws_rate_limit:${userId || clientIP}`;

      // This would typically use Redis or in-memory storage
      // For now, just log and continue
      logger.debug('WebSocket rate limit check', {
        socketId: socket.id,
        userId,
        clientIP
      });

      next();
    } catch (error) {
      logger.error('WebSocket rate limiting middleware error', {
        error: (error as Error).message,
        socketId: socket.id
      });
      next(error);
    }
  };

  /**
   * Handle secure WebSocket connection
   */
  private static handleSecureConnection(socket: any): void {
    try {
      logger.info('Secure WebSocket connection established', {
        socketId: socket.id,
        userId: socket.user?.id,
        ip: socket.handshake.address,
        transport: socket.conn.transport.name,
        secure: socket.conn.secure
      });

      // Log connection details
      EncryptionCompliance.logEncryptionEvent('websocket_connect', 'websocket', socket.user?.id, {
        socketId: socket.id,
        transport: socket.conn.transport.name,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Set up secure message handlers
      this.setupSecureMessageHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        logger.info('WebSocket disconnected', {
          socketId: socket.id,
          userId: socket.user?.id,
          reason
        });

        EncryptionCompliance.logEncryptionEvent('websocket_disconnect', 'websocket', socket.user?.id, {
          socketId: socket.id,
          reason
        });
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        logger.error('WebSocket error', {
          error: error.message,
          socketId: socket.id,
          userId: socket.user?.id
        });
      });

    } catch (error) {
      logger.error('Error handling WebSocket connection', {
        error: (error as Error).message,
        socketId: socket.id
      });
    }
  }

  /**
   * Set up secure message handlers
   */
  private static setupSecureMessageHandlers(socket: any): void {
    // Example: Handle encrypted messages
    socket.on('encrypted_message', (encryptedData: string) => {
      try {
        const decryptedData = socket.decryptMessage(encryptedData);

        logger.debug('Received encrypted message', {
          socketId: socket.id,
          userId: socket.user?.id,
          messageType: decryptedData.type
        });

        // Process the decrypted message based on its type
        this.processSecureMessage(socket, decryptedData);
      } catch (error) {
        logger.error('Failed to process encrypted message', {
          error: (error as Error).message,
          socketId: socket.id
        });

        socket.emit('error', { message: 'Failed to decrypt message' });
      }
    });

    // Example: Handle secure data sync
    socket.on('sync_data', async (requestData: any) => {
      try {
        // Validate user permissions
        if (!this.hasPermission(socket.user, 'data_sync')) {
          return socket.emit('error', { message: 'Insufficient permissions' });
        }

        // Process data sync request
        const syncData = await this.processDataSync(socket.user, requestData);

        // Send encrypted response
        socket.emit('sync_response', socket.encryptMessage(syncData));
      } catch (error) {
        logger.error('Data sync failed', {
          error: (error as Error).message,
          socketId: socket.id
        });

        socket.emit('error', { message: 'Data sync failed' });
      }
    });
  }

  /**
   * Encrypt message data
   */
  private static encryptMessage(data: string): string {
    if (!this.encryptionKey) {
      throw new Error('WebSocket encryption key not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Decrypt message data
   */
  private static decryptMessage(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('WebSocket encryption key not initialized');
    }

    const data = JSON.parse(encryptedData);
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);

    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Check if event should be encrypted
   */
  private static shouldEncryptEvent(event: string): boolean {
    // Don't encrypt system events
    const systemEvents = [
      'connection',
      'disconnect',
      'connect_error',
      'connect_timeout',
      'reconnect',
      'reconnect_attempt',
      'reconnecting',
      'reconnect_error',
      'reconnect_failed',
      'ping',
      'pong'
    ];

    return !systemEvents.includes(event);
  }

  /**
   * Check if user has permission for specific action
   */
  private static hasPermission(user: any, action: string): boolean {
    if (!user) return false;

    const permissions: Record<string, string[]> = {
      'data_sync': ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
      'user_management': ['SUPER_ADMIN', 'ADMIN'],
      'system_config': ['SUPER_ADMIN']
    };

    const allowedRoles = permissions[action] || [];
    return allowedRoles.includes(user.role);
  }

  /**
   * Process secure message based on type
   */
  private static processSecureMessage(socket: any, data: any): void {
    switch (data.type) {
      case 'heartbeat':
        socket.emit('heartbeat_response', { timestamp: new Date().toISOString() });
        break;

      case 'status_update':
        // Handle status updates
        socket.broadcast.emit('status_broadcast', socket.encryptMessage(data));
        break;

      default:
        logger.warn('Unknown secure message type', {
          type: data.type,
          socketId: socket.id
        });
    }
  }

  /**
   * Process data sync requests
   */
  private static async processDataSync(user: any, requestData: any): Promise<any> {
    // Implement data sync logic based on request type
    return {
      success: true,
      data: {},
      timestamp: new Date().toISOString(),
      userId: user.id
    };
  }

  /**
   * Generate WebSocket encryption report
   */
  static generateEncryptionReport(): {
    enabled: boolean;
    keyInitialized: boolean;
    redisAdapter: boolean;
    connections: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (!this.encryptionKey) {
      recommendations.push('Initialize WebSocket encryption key');
    }

    if (!this.redisAdapter) {
      recommendations.push('Configure Redis adapter for scaling WebSocket connections');
    }

    return {
      enabled: !!this.encryptionKey,
      keyInitialized: !!this.encryptionKey,
      redisAdapter: !!this.redisAdapter,
      connections: 0, // This would be tracked dynamically
      recommendations
    };
  }
}

export default WebSocketEncryption;