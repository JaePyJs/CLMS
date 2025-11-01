import { IncomingMessage } from 'http';
import { URL } from 'url';
import { authService, JWTPayload } from '../services/authService';
import { logger, securityLogger } from '../utils/logger';

export interface WebSocketAuthResult {
  success: boolean;
  user?: JWTPayload;
  error?: string;
  statusCode?: number;
}

export interface WebSocketAuthOptions {
  requireAuth?: boolean;
  allowedRoles?: string[];
  rateLimitEnabled?: boolean;
  maxConnectionsPerUser?: number;
}

/**
 * Authenticate WebSocket connection
 */
export async function authenticateWebSocket(
  request: IncomingMessage,
  options: WebSocketAuthOptions = {},
): Promise<WebSocketAuthResult> {
  const {
    requireAuth = true,
    allowedRoles,
    rateLimitEnabled = true,
    maxConnectionsPerUser = 5,
  } = options;

  try {
    // Extract token from query parameters or headers
    const token = extractTokenFromRequest(request);

    if (!token) {
      if (requireAuth) {
        securityLogger.failedAuth(
          'websocket',
          'No token provided',
          getClientIP(request),
        );
        return {
          success: false,
          error: 'Authentication required',
          statusCode: 4011,
        };
      }

      // Anonymous connection allowed
      return {
        success: true,
      };
    }

    // Verify JWT token
    const user = authService.verifyToken(token);
    if (!user) {
      securityLogger.failedAuth(
        'websocket',
        'Invalid token',
        getClientIP(request),
      );
      return {
        success: false,
        error: 'Invalid authentication token',
        statusCode: 4011,
      };
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (user.exp && user.exp < now) {
      securityLogger.failedAuth(
        'websocket',
        'Token expired',
        getClientIP(request),
      );
      return {
        success: false,
        error: 'Authentication token expired',
        statusCode: 4011,
      };
    }

    // Check user role if specified
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        securityLogger.permissionDenied(
          user.userId ?? user.id,
          'websocket',
          'connect',
          getClientIP(request),
        );
        return {
          success: false,
          error: 'Insufficient permissions for WebSocket connection',
          statusCode: 4013,
        };
      }
    }

    // Rate limiting check (if enabled)
    if (rateLimitEnabled) {
      const rateLimitResult = await checkRateLimit(
        user.userId ?? user.id,
        maxConnectionsPerUser,
      );
      if (!rateLimitResult.allowed) {
        securityLogger.failedAuth(
          'websocket',
          'Rate limit exceeded',
          getClientIP(request),
        );
        return {
          success: false,
          error: 'Too many WebSocket connections',
          statusCode: 4013,
        };
      }
    }

    // Log successful authentication
    logger.info('WebSocket authentication successful', {
      userId: user.userId ?? user.id,
      username: user.username,
      role: user.role,
      ip: getClientIP(request),
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      user,
    };
  } catch (error) {
    logger.error('WebSocket authentication error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      ip: getClientIP(request),
    });

    securityLogger.failedAuth(
      'websocket',
      (error as Error).message,
      getClientIP(request),
    );

    return {
      success: false,
      error: 'Authentication failed',
      statusCode: 4011,
    };
  }
}

/**
 * Extract authentication token from WebSocket request
 */
function extractTokenFromRequest(request: IncomingMessage): string | null {
  try {
    // Try to get token from URL query parameters
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const tokenFromQuery = url.searchParams.get('token');
    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    // Try to get token from Authorization header
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get token from custom header (for WebSocket compatibility)
    const wsToken = request.headers['x-websocket-token'] as string;
    if (wsToken) {
      return wsToken;
    }

    return null;
  } catch (error) {
    logger.error('Error extracting token from WebSocket request', {
      error: (error as Error).message,
      url: request.url ?? '',
    });
    return null;
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: IncomingMessage): string {
  // Try various headers for the real IP
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const firstIP = (forwardedFor as string).split(',')[0];
    return firstIP ? firstIP.trim() : 'unknown';
  }

  const realIP = request.headers['x-real-ip'];
  if (realIP) {
    return realIP as string;
  }

  const clientIP = request.headers['x-client-ip'];
  if (clientIP) {
    return clientIP as string;
  }

  // Fallback to remote address
  const socket = request.socket;
  return socket && socket.remoteAddress ? socket.remoteAddress : 'unknown';
}

/**
 * Rate limiting for WebSocket connections
 */
const connectionAttempts = new Map<
  string,
  { count: number; resetTime: number }
>();

async function checkRateLimit(
  userId: string,
  maxConnections: number,
): Promise<{ allowed: boolean }> {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  const attempts = connectionAttempts.get(userId);

  if (!attempts) {
    // First attempt
    connectionAttempts.set(userId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true };
  }

  // Reset window if expired
  if (now > attempts.resetTime) {
    connectionAttempts.set(userId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (attempts.count >= maxConnections) {
    return { allowed: false };
  }

  // Increment counter
  attempts.count++;
  return { allowed: true };
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimitEntries(): void {
  const now = Date.now();

  for (const [userId, attempts] of connectionAttempts.entries()) {
    if (now > attempts.resetTime) {
      connectionAttempts.delete(userId);
    }
  }
}

/**
 * WebSocket authentication middleware for Express integration
 */
export function createWebSocketAuthMiddleware(
  options: WebSocketAuthOptions = {},
) {
  return async (request: IncomingMessage): Promise<WebSocketAuthResult> => {
    return authenticateWebSocket(request, options);
  };
}

/**
 * Validate WebSocket upgrade request
 */
export function validateWebSocketUpgrade(request: IncomingMessage): {
  valid: boolean;
  error?: string;
} {
  // Check required headers
  const upgrade = request.headers.upgrade;
  const connection = request.headers.connection;

  if (upgrade !== 'websocket') {
    return { valid: false, error: 'Invalid upgrade header' };
  }

  if (!connection || !connection.toLowerCase().includes('upgrade')) {
    return { valid: false, error: 'Invalid connection header' };
  }

  // Check for WebSocket version
  const wsVersion = request.headers['sec-websocket-version'];
  if (!wsVersion || wsVersion !== '13') {
    return { valid: false, error: 'Unsupported WebSocket version' };
  }

  // Check for WebSocket key
  const wsKey = request.headers['sec-websocket-key'];
  if (!wsKey) {
    return { valid: false, error: 'Missing WebSocket key' };
  }

  return { valid: true };
}

/**
 * Get WebSocket connection metadata
 */
export function getConnectionMetadata(request: IncomingMessage): {
  ip: string;
  userAgent?: string;
  origin?: string;
  protocol?: string;
} {
  const ua = request.headers['user-agent'];
  const origin = request.headers.origin;
  const protocol = request.headers['sec-websocket-protocol'];

  const metadata: {
    ip: string;
    userAgent?: string;
    origin?: string;
    protocol?: string;
  } = {
    ip: getClientIP(request),
  };
  if (typeof ua === 'string') metadata.userAgent = ua;
  if (typeof origin === 'string') metadata.origin = origin;
  if (typeof protocol === 'string') metadata.protocol = protocol;
  return metadata;
}

/**
 * Set up periodic cleanup of rate limit entries
 */
export function setupPeriodicCleanup(): NodeJS.Timeout {
  return setInterval(
    () => {
      cleanupRateLimitEntries();
    },
    5 * 60 * 1000,
  ); // Every 5 minutes
}
