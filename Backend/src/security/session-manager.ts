import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';

interface SessionData {
  userId: string;
  username: string;
  role: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  mfaVerified?: boolean;
  sessionFlags: {
    suspiciousActivity: boolean;
    forceReauth: boolean;
    deviceTrusted: boolean;
  };
}

interface RefreshTokenData {
  sessionId: string;
  userId: string;
  tokenFamily: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsed: Date;
  revoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
}

interface SecurityEvent {
  type: 'login' | 'logout' | 'token_refresh' | 'suspicious_activity' | 'session_hijack_attempt';
  userId?: string;
  sessionId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
}

export class SessionManager {
  private redis: Redis;
  private jwtSecret: string;
  private accessTokenTTL: number;
  private refreshTokenTTL: number;
  private maxSessionsPerUser: number;

  constructor(redis: Redis) {
    this.redis = redis;
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
    this.accessTokenTTL = parseInt(process.env.JWT_ACCESS_TOKEN_TTL || '900'); // 15 minutes
    this.refreshTokenTTL = parseInt(process.env.JWT_REFRESH_TOKEN_TTL || '604800'); // 7 days
    this.maxSessionsPerUser = parseInt(process.env.MAX_SESSIONS_PER_USER || '5');
  }

  async createSession(
    userId: string,
    username: string,
    role: string,
    ipAddress: string,
    userAgent: string,
    deviceId?: string
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    try {
      const sessionId = this.generateSessionId();
      const tokenFamily = this.generateTokenFamily();
      const now = new Date();

      // Clean up old sessions if at max limit
      await this.cleanupOldSessions(userId);

      // Create session data
      const sessionData: SessionData = {
        userId,
        username,
        role,
        loginTime: now,
        lastActivity: now,
        ipAddress,
        userAgent,
        deviceId,
        mfaVerified: false,
        sessionFlags: {
          suspiciousActivity: false,
          forceReauth: false,
          deviceTrusted: false
        }
      };

      // Store session in Redis
      const sessionKey = `session:${sessionId}`;
      await this.redis.hset(sessionKey, {
        ...sessionData,
        loginTime: sessionData.loginTime.toISOString(),
        lastActivity: sessionData.lastActivity.toISOString(),
        sessionFlags: JSON.stringify(sessionData.sessionFlags)
      });
      await this.redis.expire(sessionKey, this.refreshTokenTTL);

      // Create refresh token data
      const refreshTokenData: RefreshTokenData = {
        sessionId,
        userId,
        tokenFamily,
        createdAt: now,
        expiresAt: new Date(now.getTime() + this.refreshTokenTTL * 1000),
        lastUsed: now,
        revoked: false
      };

      // Store refresh token
      const refreshTokenKey = `refresh_token:${sessionId}`;
      await this.redis.hset(refreshTokenKey, {
        ...refreshTokenData,
        createdAt: refreshTokenData.createdAt.toISOString(),
        expiresAt: refreshTokenData.expiresAt.toISOString(),
        lastUsed: refreshTokenData.lastUsed.toISOString()
      });
      await this.redis.expire(refreshTokenKey, this.refreshTokenTTL);

      // Track user sessions
      await this.redis.sadd(`user_sessions:${userId}`, sessionId);
      await this.redis.expire(`user_sessions:${userId}`, this.refreshTokenTTL);

      // Generate tokens
      const accessToken = this.generateAccessToken(sessionId, userId, username, role);
      const refreshToken = this.generateRefreshToken(sessionId, tokenFamily);

      // Log security event
      await this.logSecurityEvent({
        type: 'login',
        userId,
        sessionId,
        timestamp: now,
        ipAddress,
        userAgent,
        details: { deviceId, tokenFamily }
      });

      logger.info('Session created', {
        sessionId: sessionId.substring(0, 8) + '...',
        userId,
        ipAddress,
        userAgent: userAgent.substring(0, 50) + '...'
      });

      return {
        accessToken,
        refreshToken,
        sessionId
      };

    } catch (error) {
      logger.error('Failed to create session', {
        error: (error as Error).message,
        userId
      });
      throw new Error('Failed to create session');
    }
  }

  async refreshSession(
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string } | null> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;
      const { sessionId, tokenFamily } = decoded;

      // Get session data
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        logger.warn('Refresh attempt for non-existent session', {
          sessionId: sessionId.substring(0, 8) + '...'
        });
        return null;
      }

      // Get refresh token data
      const refreshTokenKey = `refresh_token:${sessionId}`;
      const tokenData = await this.redis.hgetall(refreshTokenKey);

      if (!tokenData || tokenData.revoked === 'true' || tokenData.tokenFamily !== tokenFamily) {
        logger.warn('Invalid or revoked refresh token used', {
          sessionId: sessionId.substring(0, 8) + '...',
          tokenFamily,
          revoked: tokenData?.revoked
        });

        // Revoke all tokens in this family if suspicious
        if (tokenData && tokenData.tokenFamily !== tokenFamily) {
          await this.revokeTokenFamily(sessionData.userId, tokenData.tokenFamily);
        }

        return null;
      }

      // Check for suspicious activity
      if (this.isSuspiciousActivity(sessionData, ipAddress, userAgent)) {
        logger.warn('Suspicious activity detected during token refresh', {
          sessionId: sessionId.substring(0, 8) + '...',
          userId: sessionData.userId,
          originalIp: sessionData.ipAddress,
          newIp: ipAddress
        });

        // Mark session as suspicious
        sessionData.sessionFlags.suspiciousActivity = true;
        await this.updateSession(sessionId, sessionData);

        // Log security event
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          userId: sessionData.userId,
          sessionId,
          timestamp: new Date(),
          ipAddress,
          userAgent,
          details: {
            reason: 'ip_address_change',
            originalIp: sessionData.ipAddress,
            newIp: ipAddress
          }
        });

        // Optionally require re-authentication
        return null;
      }

      // Update session activity
      sessionData.lastActivity = new Date();
      sessionData.ipAddress = ipAddress;
      sessionData.userAgent = userAgent;
      await this.updateSession(sessionId, sessionData);

      // Update refresh token usage
      await this.redis.hset(refreshTokenKey, {
        lastUsed: new Date().toISOString()
      });

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(sessionId, sessionData.userId, sessionData.username, sessionData.role);
      const newRefreshToken = this.generateRefreshToken(sessionId, tokenFamily);

      // Log security event
      await this.logSecurityEvent({
        type: 'token_refresh',
        userId: sessionData.userId,
        sessionId,
        timestamp: new Date(),
        ipAddress,
        userAgent,
        details: { tokenFamily }
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        sessionId
      };

    } catch (error) {
      logger.error('Failed to refresh session', {
        error: (error as Error).message
      });
      return null;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionKey = `session:${sessionId}`;
      const data = await this.redis.hgetall(sessionKey);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        userId: data.userId,
        username: data.username,
        role: data.role,
        loginTime: new Date(data.loginTime),
        lastActivity: new Date(data.lastActivity),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceId: data.deviceId,
        mfaVerified: data.mfaVerified === 'true',
        sessionFlags: JSON.parse(data.sessionFlags || '{}')
      };

    } catch (error) {
      logger.error('Failed to get session', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...'
      });
      return null;
    }
  }

  async updateSession(sessionId: string, sessionData: Partial<SessionData>): Promise<void> {
    try {
      const sessionKey = `session:${sessionId}`;
      const updateData: Record<string, string> = {};

      if (sessionData.lastActivity) {
        updateData.lastActivity = sessionData.lastActivity.toISOString();
      }
      if (sessionData.ipAddress) {
        updateData.ipAddress = sessionData.ipAddress;
      }
      if (sessionData.userAgent) {
        updateData.userAgent = sessionData.userAgent;
      }
      if (sessionData.sessionFlags) {
        updateData.sessionFlags = JSON.stringify(sessionData.sessionFlags);
      }
      if (sessionData.mfaVerified !== undefined) {
        updateData.mfaVerified = sessionData.mfaVerified.toString();
      }

      if (Object.keys(updateData).length > 0) {
        await this.redis.hmset(sessionKey, updateData);
      }

    } catch (error) {
      logger.error('Failed to update session', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...'
      });
    }
  }

  async destroySession(sessionId: string, reason: string = 'logout'): Promise<void> {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        return;
      }

      // Mark refresh token as revoked
      const refreshTokenKey = `refresh_token:${sessionId}`;
      await this.redis.hset(refreshTokenKey, {
        revoked: 'true',
        revokedAt: new Date().toISOString(),
        revokedReason: reason
      });

      // Remove session
      const sessionKey = `session:${sessionId}`;
      await this.redis.del(sessionKey);

      // Remove from user sessions
      await this.redis.srem(`user_sessions:${sessionData.userId}`, sessionId);

      // Log security event
      await this.logSecurityEvent({
        type: 'logout',
        userId: sessionData.userId,
        sessionId,
        timestamp: new Date(),
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        details: { reason }
      });

      logger.info('Session destroyed', {
        sessionId: sessionId.substring(0, 8) + '...',
        userId: sessionData.userId,
        reason
      });

    } catch (error) {
      logger.error('Failed to destroy session', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...'
      });
    }
  }

  async destroyAllUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    try {
      const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);

      for (const sessionId of sessionIds) {
        if (sessionId !== excludeSessionId) {
          await this.destroySession(sessionId, 'admin_revocation');
        }
      }

      logger.info('All user sessions destroyed', {
        userId,
        sessionCount: sessionIds.length,
        excluded: excludeSessionId
      });

    } catch (error) {
      logger.error('Failed to destroy all user sessions', {
        error: (error as Error).message,
        userId
      });
    }
  }

  async revokeTokenFamily(userId: string, tokenFamily: string): Promise<void> {
    try {
      const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);

      for (const sessionId of sessionIds) {
        const refreshTokenKey = `refresh_token:${sessionId}`;
        const tokenData = await this.redis.hgetall(refreshTokenKey);

        if (tokenData.tokenFamily === tokenFamily) {
          await this.redis.hset(refreshTokenKey, {
            revoked: 'true',
            revokedAt: new Date().toISOString(),
            revokedReason: 'token_family_revocation'
          });

          await this.destroySession(sessionId, 'token_family_revocation');
        }
      }

      logger.warn('Token family revoked', {
        userId,
        tokenFamily,
        sessionsAffected: sessionIds.length
      });

    } catch (error) {
      logger.error('Failed to revoke token family', {
        error: (error as Error).message,
        userId,
        tokenFamily
      });
    }
  }

  private async cleanupOldSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);

      if (sessionIds.length >= this.maxSessionsPerUser) {
        // Get oldest sessions and remove them
        const sessionsWithTime: Array<{ sessionId: string; lastActivity: Date }> = [];

        for (const sessionId of sessionIds) {
          const sessionData = await this.getSession(sessionId);
          if (sessionData) {
            sessionsWithTime.push({
              sessionId,
              lastActivity: sessionData.lastActivity
            });
          }
        }

        // Sort by last activity (oldest first)
        sessionsWithTime.sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime());

        // Remove oldest sessions to maintain limit
        const sessionsToRemove = sessionsWithTime.slice(0, sessionsWithTime.length - this.maxSessionsPerUser + 1);

        for (const { sessionId } of sessionsToRemove) {
          await this.destroySession(sessionId, 'session_limit_exceeded');
        }

        logger.info('Old sessions cleaned up', {
          userId,
          removedCount: sessionsToRemove.length,
          totalSessions: sessionIds.length
        });
      }

    } catch (error) {
      logger.error('Failed to cleanup old sessions', {
        error: (error as Error).message,
        userId
      });
    }
  }

  private isSuspiciousActivity(sessionData: SessionData, ipAddress: string, userAgent: string): boolean {
    // Check for IP address change
    if (sessionData.ipAddress !== ipAddress) {
      return true;
    }

    // Check for user agent change
    if (sessionData.userAgent !== userAgent) {
      return true;
    }

    // Check for unusual time between activities
    const timeSinceLastActivity = Date.now() - sessionData.lastActivity.getTime();
    const maxInactivityTime = 24 * 60 * 60 * 1000; // 24 hours

    if (timeSinceLastActivity > maxInactivityTime) {
      return true;
    }

    return false;
  }

  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const eventKey = `security_event:${event.sessionId}:${Date.now()}`;
      await this.redis.hset(eventKey, {
        ...event,
        timestamp: event.timestamp.toISOString(),
        details: JSON.stringify(event.details)
      });
      await this.redis.expire(eventKey, 7 * 24 * 60 * 60); // Keep for 7 days

      // Also log to database for permanent record
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          action: `security_${event.type}`,
          details: {
            sessionId: event.sessionId,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            ...event.details
          },
          timestamp: event.timestamp
        }
      });

    } catch (error) {
      logger.error('Failed to log security event', {
        error: (error as Error).message,
        eventType: event.type
      });
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateAccessToken(sessionId: string, userId: string, username: string, role: string): string {
    const payload = {
      type: 'access',
      sessionId,
      sub: userId,        // Standard JWT claim for subject (user ID)
      id: userId,         // Legacy support
      userId,
      username,
      role,
      iss: process.env.JWT_ISSUER || 'clms-api',         // Issuer claim
      aud: process.env.JWT_AUDIENCE || 'clms-frontend',  // Audience claim
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: `${this.accessTokenTTL}s`,
      algorithm: 'HS256'
    });
  }

  private generateRefreshToken(sessionId: string, tokenFamily: string): string {
    const payload = {
      type: 'refresh',
      sessionId,
      tokenFamily,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: `${this.refreshTokenTTL}s` });
  }

  // Get all active sessions for a user
  async getUserSessions(userId: string): Promise<Array<{ sessionId: string; sessionData: SessionData }>> {
    try {
      const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
      const sessions = [];

      for (const sessionId of sessionIds) {
        const sessionData = await this.getSession(sessionId);
        if (sessionData) {
          sessions.push({ sessionId, sessionData });
        }
      }

      return sessions;

    } catch (error) {
      logger.error('Failed to get user sessions', {
        error: (error as Error).message,
        userId
      });
      return [];
    }
  }

  // Get session statistics
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessionsToday: number;
    suspiciousSessions: number;
  }> {
    try {
      const keys = await this.redis.keys('session:*');
      const totalSessions = keys.length;

      let activeSessionsToday = 0;
      let suspiciousSessions = 0;

      for (const key of keys) {
        const sessionData = await this.getSession(key.replace('session:', ''));
        if (sessionData) {
          const today = new Date().toDateString();
          if (sessionData.lastActivity.toDateString() === today) {
            activeSessionsToday++;
          }
          if (sessionData.sessionFlags.suspiciousActivity) {
            suspiciousSessions++;
          }
        }
      }

      return {
        totalSessions,
        activeSessionsToday,
        suspiciousSessions
      };

    } catch (error) {
      logger.error('Failed to get session stats', {
        error: (error as Error).message
      });
      return {
        totalSessions: 0,
        activeSessionsToday: 0,
        suspiciousSessions: 0
      };
    }
  }
}