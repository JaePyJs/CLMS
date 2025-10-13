import { Request, Response } from 'express';
import Redis from 'ioredis';
import { SessionManager } from '@/security/session-manager';
import { authService } from './authService';
import { logger } from '@/utils/logger';

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Initialize SessionManager
const sessionManager = new SessionManager(redis);

/**
 * Enhanced authentication service that integrates SessionManager
 * for secure token management with rotation and revocation
 */
export class EnhancedAuthService {
  /**
   * Login user with enhanced security features
   * - Creates session with SessionManager
   * - Generates access and refresh tokens
   * - Sets secure HttpOnly cookies
   */
  async login(
    username: string,
    password: string,
    req: Request,
    res: Response
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Validate credentials using existing authService
      const result = await authService.login(username, password);

      if (!result.success || !result.user) {
        return {
          success: false,
          error: result.error || 'Invalid credentials'
        };
      }

      // Extract request metadata
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
      const userAgent = req.headers['user-agent'] || 'unknown';
      const deviceId = req.headers['x-device-id'] as string | undefined;

      // Create session with SessionManager
      const session = await sessionManager.createSession(
        result.user.id,
        result.user.username,
        result.user.role,
        ipAddress,
        userAgent,
        deviceId
      );

      // Set secure cookies
      this.setAuthCookies(res, session.accessToken, session.refreshToken);

      logger.info('User logged in with enhanced security', {
        username,
        sessionId: session.sessionId,
        ipAddress
      });

      return {
        success: true,
        user: {
          ...result.user,
          sessionId: session.sessionId,
          accessToken: session.accessToken,  // For mobile apps
          refreshToken: session.refreshToken  // For mobile apps
        }
      };
    } catch (error) {
      logger.error('Enhanced login error', {
        error: (error as Error).message,
        username
      });
      return {
        success: false,
        error: 'An error occurred during login'
      };
    }
  }

  /**
   * Refresh access token using refresh token
   * - Validates refresh token
   * - Rotates refresh token
   * - Issues new access token
   */
  async refresh(
    refreshToken: string,
    req: Request,
    res: Response
  ): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; error?: string }> {
    try {
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Refresh session with SessionManager (includes rotation)
      const newSession = await sessionManager.refreshSession(
        refreshToken,
        ipAddress,
        userAgent
      );

      if (!newSession) {
        return {
          success: false,
          error: 'Invalid or expired refresh token'
        };
      }

      // Set new secure cookies
      this.setAuthCookies(res, newSession.accessToken, newSession.refreshToken);

      logger.info('Token refreshed successfully', {
        sessionId: newSession.sessionId
      });

      return {
        success: true,
        accessToken: newSession.accessToken,
        refreshToken: newSession.refreshToken
      };
    } catch (error) {
      logger.error('Token refresh error', {
        error: (error as Error).message
      });
      return {
        success: false,
        error: 'An error occurred during token refresh'
      };
    }
  }

  /**
   * Logout user from current session
   * - Revokes session
   * - Clears cookies
   */
  async logout(
    sessionId: string,
    res: Response
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Revoke session
      await sessionManager.revokeSession(sessionId, 'User logout');

      // Clear cookies
      this.clearAuthCookies(res);

      logger.info('User logged out successfully', { sessionId });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Logout error', {
        error: (error as Error).message,
        sessionId
      });
      return {
        success: false,
        error: 'An error occurred during logout'
      };
    }
  }

  /**
   * Logout user from all devices
   * - Revokes all user sessions
   * - Clears cookies
   */
  async logoutAll(
    userId: string,
    res: Response
  ): Promise<{ success: boolean; sessionsRevoked?: number; error?: string }> {
    try {
      // Revoke all user sessions
      const count = await sessionManager.revokeAllUserSessions(userId, 'Logout all devices');

      // Clear cookies
      this.clearAuthCookies(res);

      logger.info('User logged out from all devices', { userId, sessionsRevoked: count });

      return {
        success: true,
        sessionsRevoked: count
      };
    } catch (error) {
      logger.error('Logout all error', {
        error: (error as Error).message,
        userId
      });
      return {
        success: false,
        error: 'An error occurred during logout'
      };
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      return await sessionManager.getUserSessions(userId);
    } catch (error) {
      logger.error('Get user sessions error', {
        error: (error as Error).message,
        userId
      });
      return [];
    }
  }

  /**
   * Validate if a session is still valid
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      return await sessionManager.validateSession(sessionId);
    } catch (error) {
      logger.error('Validate session error', {
        error: (error as Error).message,
        sessionId
      });
      return false;
    }
  }

  /**
   * Set secure authentication cookies
   */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSecure = process.env.COOKIE_SECURE === 'true' || isProduction;
    const sameSite = (process.env.COOKIE_SAMESITE as 'strict' | 'lax' | 'none') || 'strict';

    // Access token cookie (15 minutes)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: sameSite,
      maxAge: parseInt(process.env.JWT_ACCESS_TOKEN_TTL || '900') * 1000, // Convert to milliseconds
      path: '/'
    });

    // Refresh token cookie (7 days)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: sameSite,
      maxAge: parseInt(process.env.JWT_REFRESH_TOKEN_TTL || '604800') * 1000, // Convert to milliseconds
      path: '/api/auth/refresh' // Only sent to refresh endpoint
    });
  }

  /**
   * Clear authentication cookies
   */
  private clearAuthCookies(res: Response): void {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  }
}

// Export singleton instance
export const enhancedAuthService = new EnhancedAuthService();
export default enhancedAuthService;
