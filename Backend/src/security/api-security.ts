import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { securityMonitor, SecurityEventType, SecuritySeverity } from './security-monitor';
import { auditTrail } from './audit-trail';
import { csrfProtection } from './csrf-protection';
import { inputValidator } from './input-validator';
import { rateLimit } from 'express-rate-limit';

export interface APISecurityConfig {
  enableRateLimiting: boolean;
  enableInputValidation: boolean;
  enableCSRFProtection: boolean;
  enableSecurityMonitoring: boolean;
  enableAuditLogging: boolean;
  enableIPWhitelisting: boolean;
  enableAPIKeyAuth: boolean;
  maxRequestsPerMinute: number;
  maxRequestSize: number;
  allowedOrigins: string[];
  blockedIPs: string[];
  whitelistedIPs: string[];
  sensitiveEndpoints: string[];
  publicEndpoints: string[];
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
}

export interface SecurityContext {
  ipAddress: string;
  userAgent: string;
  requestId: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  userId?: string;
  sessionId?: string;
  apiKey?: string;
  isBlocked: boolean;
  isRateLimited: boolean;
  isSuspicious: boolean;
  riskScore: number;
}

export class APISecurity {
  private redis: Redis;
  private config: APISecurityConfig;
  private apiKeys: Map<string, APIKey> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousIPs: Map<string, number> = new Map(); // IP -> score

  constructor(redis: Redis, config: Partial<APISecurityConfig> = {}) {
    this.redis = redis;
    this.config = {
      enableRateLimiting: true,
      enableInputValidation: true,
      enableCSRFProtection: true,
      enableSecurityMonitoring: true,
      enableAuditLogging: true,
      enableIPWhitelisting: false,
      enableAPIKeyAuth: false,
      maxRequestsPerMinute: 100,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedOrigins: [],
      blockedIPs: [],
      whitelistedIPs: [],
      sensitiveEndpoints: [
        '/api/users',
        '/api/settings',
        '/api/system',
        '/api/security',
        '/api/admin',
        '/api/backup'
      ],
      publicEndpoints: [
        '/api/auth/login',
        '/api/auth/register',
        '/api/health',
        '/api/docs',
        '/api/public'
      ],
      ...config
    };

    this.initializeSecurityData();
    this.startIPMonitoring();
  }

  // Main security middleware
  apiSecurity() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const startTime = Date.now();
        const context = await this.buildSecurityContext(req);

        // Check if IP is blocked
        if (context.isBlocked) {
          await this.handleBlockedRequest(req, res, context);
          return;
        }

        // Check request size
        if (!this.checkRequestSize(req)) {
          await this.handleOversizedRequest(req, res, context);
          return;
        }

        // Check API key authentication if enabled
        if (this.config.enableAPIKeyAuth) {
          const authResult = await this.authenticateAPIKey(req, context);
          if (!authResult.success) {
            await this.handleInvalidAPIKey(req, res, context, authResult.error);
            return;
          }
        }

        // Check IP whitelisting if enabled
        if (this.config.enableIPWhitelisting && !this.isIPWhitelisted(context.ipAddress)) {
          await this.handleNonWhitelistedIP(req, res, context);
          return;
        }

        // Check rate limiting if enabled
        if (this.config.enableRateLimiting && this.shouldRateLimit(req)) {
          const rateLimitResult = await this.checkRateLimit(req, context);
          if (!rateLimitResult.allowed) {
            await this.handleRateLimitExceeded(req, res, context, rateLimitResult);
            return;
          }
        }

        // Check for suspicious activity
        if (this.config.enableSecurityMonitoring) {
          const suspiciousCheck = await this.checkSuspiciousActivity(req, context);
          if (suspiciousCheck.isSuspicious) {
            context.isSuspicious = true;
            context.riskScore = suspiciousCheck.riskScore;

            // Log security event
            await securityMonitor.recordSecurityEvent({
              type: SecurityEventType.SUSPICIOUS_IP_ADDRESS,
              severity: suspiciousCheck.riskScore > 0.8 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM,
              userId: context.userId,
              sessionId: context.sessionId,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
              timestamp: context.timestamp,
              details: {
                endpoint: context.endpoint,
                method: context.method,
                riskScore: context.riskScore,
                reasons: suspiciousCheck.reasons
              },
              resolved: false
            });

            // Block if high risk
            if (context.riskScore > 0.9) {
              await this.blockIPAddress(context.ipAddress, 'High risk activity detected', 3600);
              await this.handleBlockedRequest(req, res, context);
              return;
            }
          }
        }

        // Add security context to request
        (req as any).securityContext = context;

        // Add security headers
        this.addSecurityHeaders(res, context);

        // Continue to next middleware
        next();

        // Log request after response (in a setImmediate to not block)
        setImmediate(async () => {
          try {
            const duration = Date.now() - startTime;
            await this.logRequest(req, res, context, duration);
          } catch (error) {
            logger.error('Failed to log request in security middleware', {
              error: (error as Error).message
            });
          }
        });

      } catch (error) {
        logger.error('Security middleware error', {
          error: (error as Error).message,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        // Fail open - allow request but log error
        next();
      }
    };
  }

  // Specific middleware for sensitive endpoints
  sensitiveEndpointProtection() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const context = (req as any).securityContext;
        if (!context) {
          res.status(500).json({
            success: false,
            error: 'Security context not found'
          });
          return;
        }

        // Check if endpoint is sensitive
        if (!this.isSensitiveEndpoint(req.path)) {
          next();
          return;
        }

        // Enhanced checks for sensitive endpoints
        const enhancedChecks = await this.performEnhancedSecurityChecks(req, context);
        if (!enhancedChecks.passed) {
          res.status(403).json({
            success: false,
            error: 'Access denied',
            reason: enhancedChecks.reason,
            code: 'SENSITIVE_ENDPOINT_PROTECTION'
          });
          return;
        }

        // Require additional authentication for sensitive operations
        if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
          if (!context.userId && !context.apiKey) {
            res.status(401).json({
              success: false,
              error: 'Authentication required for sensitive operations',
              code: 'SENSITIVE_OPERATION_AUTH_REQUIRED'
            });
            return;
          }

          // Check for recent authentication (within last hour)
          const recentAuth = await this.checkRecentAuthentication(context);
          if (!recentAuth) {
            res.status(401).json({
              success: false,
              error: 'Recent authentication required for sensitive operations',
              code: 'RECENT_AUTH_REQUIRED'
            });
            return;
          }
        }

        next();

      } catch (error) {
        logger.error('Sensitive endpoint protection error', {
          error: (error as Error).message,
          path: req.path
        });

        res.status(500).json({
          success: false,
          error: 'Security check failed'
        });
      }
    };
  }

  // API key management
  async createAPIKey(name: string, permissions: string[], rateLimit?: number): Promise<APIKey> {
    try {
      const apiKey: APIKey = {
        id: this.generateKeyId(),
        name,
        key: this.generateAPIKey(),
        permissions,
        rateLimit: rateLimit || this.config.maxRequestsPerMinute,
        isActive: true,
        createdAt: new Date(),
        usageCount: 0
      };

      // Store API key
      await this.redis.hset(`api_key:${apiKey.id}`, {
        ...apiKey,
        createdAt: apiKey.createdAt.toISOString(),
        expiresAt: apiKey.expiresAt?.toISOString()
      });

      // Add to active keys set
      await this.redis.sadd('active_api_keys', apiKey.id);

      this.apiKeys.set(apiKey.id, apiKey);

      logger.info('API key created', {
        keyId: apiKey.id,
        name,
        permissions: permissions.length,
        rateLimit
      });

      return apiKey;

    } catch (error) {
      logger.error('Failed to create API key', {
        error: (error as Error).message,
        name
      });
      throw error;
    }
  }

  async revokeAPIKey(keyId: string): Promise<void> {
    try {
      const apiKey = await this.getAPIKey(keyId);
      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Mark as inactive
      await this.redis.hset(`api_key:${keyId}`, {
        isActive: 'false',
        revokedAt: new Date().toISOString()
      });

      // Remove from active keys set
      await this.redis.srem('active_api_keys', keyId);

      this.apiKeys.delete(keyId);

      logger.info('API key revoked', {
        keyId,
        name: apiKey.name
      });

    } catch (error) {
      logger.error('Failed to revoke API key', {
        error: (error as Error).message,
        keyId
      });
      throw error;
    }
  }

  async getAPIKey(keyId: string): Promise<APIKey | null> {
    try {
      const cached = this.apiKeys.get(keyId);
      if (cached) {
        return cached;
      }

      const keyData = await this.redis.hgetall(`api_key:${keyId}`);
      if (!keyData || Object.keys(keyData).length === 0) {
        return null;
      }

      const apiKey: APIKey = {
        id: keyData.id,
        name: keyData.name,
        key: keyData.key,
        permissions: JSON.parse(keyData.permissions || '[]'),
        rateLimit: parseInt(keyData.rateLimit),
        isActive: keyData.isActive === 'true',
        createdAt: new Date(keyData.createdAt),
        expiresAt: keyData.expiresAt ? new Date(keyData.expiresAt) : undefined,
        lastUsed: keyData.lastUsed ? new Date(keyData.lastUsed) : undefined,
        usageCount: parseInt(keyData.usageCount || '0')
      };

      this.apiKeys.set(keyId, apiKey);
      return apiKey;

    } catch (error) {
      logger.error('Failed to get API key', {
        error: (error as Error).message,
        keyId
      });
      return null;
    }
  }

  // IP management
  async blockIPAddress(ipAddress: string, reason: string, duration: number = 3600): Promise<void> {
    try {
      const blockKey = `blocked_ip:${ipAddress}`;
      await this.redis.hset(blockKey, {
        ipAddress,
        reason,
        blockedAt: new Date().toISOString(),
        blockedUntil: new Date(Date.now() + duration * 1000).toISOString()
      });
      await this.redis.expire(blockKey, duration);

      this.blockedIPs.add(ipAddress);

      // Log security event
      await securityMonitor.recordSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_IP_ADDRESS,
        severity: SecuritySeverity.HIGH,
        ipAddress,
        userAgent: 'system',
        timestamp: new Date(),
        details: {
          action: 'ip_blocked',
          reason,
          duration
        },
        resolved: false
      });

      logger.warn('IP address blocked', {
        ipAddress,
        reason,
        duration
      });

    } catch (error) {
      logger.error('Failed to block IP address', {
        error: (error as Error).message,
        ipAddress
      });
    }
  }

  async unblockIPAddress(ipAddress: string): Promise<void> {
    try {
      await this.redis.del(`blocked_ip:${ipAddress}`);
      this.blockedIPs.delete(ipAddress);

      logger.info('IP address unblocked', { ipAddress });

    } catch (error) {
      logger.error('Failed to unblock IP address', {
        error: (error as Error).message,
        ipAddress
      });
    }
  }

  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      if (this.blockedIPs.has(ipAddress)) {
        return true;
      }

      const blockKey = `blocked_ip:${ipAddress}`;
      const blocked = await this.redis.exists(blockKey);

      if (blocked === 1) {
        this.blockedIPs.add(ipAddress);
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Failed to check IP block status', {
        error: (error as Error).message,
        ipAddress
      });
      return false;
    }
  }

  private async buildSecurityContext(req: Request): Promise<SecurityContext> {
    const ipAddress = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const requestId = this.generateRequestId();

    return {
      ipAddress,
      userAgent,
      requestId,
      timestamp: new Date(),
      endpoint: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionId,
      apiKey: this.extractAPIKey(req),
      isBlocked: await this.isIPBlocked(ipAddress),
      isRateLimited: false,
      isSuspicious: false,
      riskScore: 0
    };
  }

  private checkRequestSize(req: Request): boolean {
    const contentLength = req.get('Content-Length');
    if (contentLength && parseInt(contentLength) > this.config.maxRequestSize) {
      return false;
    }
    return true;
  }

  private async authenticateAPIKey(req: Request, context: SecurityContext): Promise<{ success: boolean; error?: string; apiKey?: APIKey }> {
    if (!context.apiKey) {
      return { success: false, error: 'API key required' };
    }

    const apiKey = await this.getAPIKey(context.apiKey);
    if (!apiKey) {
      return { success: false, error: 'Invalid API key' };
    }

    if (!apiKey.isActive) {
      return { success: false, error: 'API key is inactive' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { success: false, error: 'API key has expired' };
    }

    // Update usage stats
    await this.redis.hset(`api_key:${apiKey.id}`, {
      lastUsed: new Date().toISOString(),
      usageCount: (apiKey.usageCount + 1).toString()
    });

    apiKey.lastUsed = new Date();
    apiKey.usageCount++;

    return { success: true, apiKey };
  }

  private isIPWhitelisted(ipAddress: string): boolean {
    return this.config.whitelistedIPs.includes(ipAddress) ||
           this.config.whitelistedIPs.some(whitelisted => ipAddress.startsWith(whitelisted));
  }

  private shouldRateLimit(req: Request): boolean {
    // Don't rate limit public endpoints
    return !this.config.publicEndpoints.some(endpoint => req.path.startsWith(endpoint));
  }

  private async checkRateLimit(req: Request, context: SecurityContext): Promise<{ allowed: boolean; remaining?: number; resetTime?: Date }> {
    try {
      const key = context.apiKey
        ? `rate_limit:api_key:${context.apiKey}`
        : `rate_limit:ip:${context.ipAddress}`;

      const windowMs = 60 * 1000; // 1 minute
      const maxRequests = context.apiKey
        ? (await this.getAPIKey(context.apiKey))?.rateLimit || this.config.maxRequestsPerMinute
        : this.config.maxRequestsPerMinute;

      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old entries
      await this.redis.zremrangebyscore(key, 0, windowStart);

      // Count current requests
      const currentRequests = await this.redis.zcard(key);

      if (currentRequests >= maxRequests) {
        const ttl = await this.redis.ttl(key);
        return {
          allowed: false,
          resetTime: new Date(now + ttl * 1000)
        };
      }

      // Add current request
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      await this.redis.expire(key, Math.ceil(windowMs / 1000));

      return {
        allowed: true,
        remaining: maxRequests - currentRequests - 1
      };

    } catch (error) {
      logger.error('Rate limiting check failed', {
        error: (error as Error).message,
        ipAddress: context.ipAddress
      });
      return { allowed: true }; // Fail open
    }
  }

  private async checkSuspiciousActivity(req: Request, context: SecurityContext): Promise<{ isSuspicious: boolean; riskScore: number; reasons: string[] }> {
    const reasons: string[] = [];
    let riskScore = 0;

    // Check for suspicious user agent
    if (this.isSuspiciousUserAgent(context.userAgent)) {
      reasons.push('Suspicious user agent');
      riskScore += 0.3;
    }

    // Check for suspicious request patterns
    if (this.isSuspiciousRequest(req)) {
      reasons.push('Suspicious request pattern');
      riskScore += 0.4;
    }

    // Check for rapid requests
    const rapidRequestCount = await this.checkRapidRequests(context.ipAddress);
    if (rapidRequestCount > 10) {
      reasons.push('Rapid requests detected');
      riskScore += 0.3;
    }

    // Check for unusual time patterns
    if (this.isUnusualTimePattern(context)) {
      reasons.push('Unusual access time');
      riskScore += 0.2;
    }

    // Check IP reputation
    const ipReputation = await this.checkIPReputation(context.ipAddress);
    if (ipReputation < 0) {
      reasons.push('Poor IP reputation');
      riskScore += Math.abs(ipReputation);
    }

    return {
      isSuspicious: riskScore > 0.5,
      riskScore: Math.min(riskScore, 1.0),
      reasons
    };
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /perl/i,
      /php/i,
      /ruby/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private isSuspiciousRequest(req: Request): boolean {
    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-originating-ip'
    ];

    for (const header of suspiciousHeaders) {
      if (req.get(header) && req.get(header) !== req.ip) {
        return true;
      }
    }

    // Check for suspicious query parameters
    const suspiciousParams = ['exec', 'cmd', 'system', 'eval', 'assert'];
    for (const param of suspiciousParams) {
      if (req.query[param] || req.body[param]) {
        return true;
      }
    }

    return false;
  }

  private async checkRapidRequests(ipAddress: string): Promise<number> {
    try {
      const key = `rapid_requests:${ipAddress}`;
      const windowMs = 60 * 1000; // 1 minute
      const now = Date.now();
      const windowStart = now - windowMs;

      await this.redis.zremrangebyscore(key, 0, windowStart);
      const count = await this.redis.zcard(key);

      return count;

    } catch (error) {
      logger.error('Failed to check rapid requests', {
        error: (error as Error).message,
        ipAddress
      });
      return 0;
    }
  }

  private isUnusualTimePattern(context: SecurityContext): boolean {
    const hour = context.timestamp.getHours();

    // Check for access during unusual hours (2 AM - 5 AM)
    if (hour >= 2 && hour <= 5) {
      return true;
    }

    return false;
  }

  private async checkIPReputation(ipAddress: string): Promise<number> {
    // Simple reputation scoring - can be enhanced with external threat intelligence
    const reputation = this.suspiciousIPs.get(ipAddress) || 0;
    return reputation;
  }

  private isSensitiveEndpoint(path: string): boolean {
    return this.config.sensitiveEndpoints.some(endpoint => path.startsWith(endpoint));
  }

  private async performEnhancedSecurityChecks(req: Request, context: SecurityContext): Promise<{ passed: boolean; reason?: string }> {
    // Check for recent authentication
    const recentAuth = await this.checkRecentAuthentication(context);
    if (!recentAuth && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return { passed: false, reason: 'Recent authentication required' };
    }

    // Check for concurrent sessions
    if (context.userId) {
      const concurrentSessions = await this.checkConcurrentSessions(context.userId);
      if (concurrentSessions > 5) {
        return { passed: false, reason: 'Too many concurrent sessions' };
      }
    }

    return { passed: true };
  }

  private async checkRecentAuthentication(context: SecurityContext): Promise<boolean> {
    if (!context.userId) return false;

    try {
      const key = `recent_auth:${context.userId}`;
      const lastAuth = await this.redis.get(key);

      if (lastAuth) {
        const lastAuthTime = new Date(lastAuth);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return lastAuthTime > oneHourAgo;
      }

      return false;

    } catch (error) {
      logger.error('Failed to check recent authentication', {
        error: (error as Error).message,
        userId: context.userId
      });
      return false;
    }
  }

  private async checkConcurrentSessions(userId: string): Promise<number> {
    try {
      const key = `user_sessions:${userId}`;
      return await this.redis.scard(key);

    } catch (error) {
      logger.error('Failed to check concurrent sessions', {
        error: (error as Error).message,
        userId
      });
      return 0;
    }
  }

  private addSecurityHeaders(res: Response, context: SecurityContext): void {
    res.set({
      'X-Request-ID': context.requestId,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Security-Risk-Score': context.riskScore.toString(),
      'X-Rate-Limit-Limit': this.config.maxRequestsPerMinute.toString()
    });

    if (context.isSuspicious) {
      res.set('X-Security-Warning', 'Suspicious activity detected');
    }
  }

  private async logRequest(req: Request, res: Response, context: SecurityContext, duration: number): Promise<void> {
    try {
      if (this.config.enableAuditLogging) {
        await auditTrail.logEvent({
          userId: context.userId,
          action: `${req.method}_${context.endpoint}`,
          resourceType: 'api_request',
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            requestId: context.requestId,
            riskScore: context.riskScore,
            isSuspicious: context.isSuspicious,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          severity: context.riskScore > 0.7 ? 'high' : 'low' as any,
          category: 'system',
          outcome: res.statusCode < 400 ? 'success' : 'failure',
          source: 'api'
        });
      }

    } catch (error) {
      logger.error('Failed to log API request', {
        error: (error as Error).message,
        requestId: context.requestId
      });
    }
  }

  private async handleBlockedRequest(req: Request, res: Response, context: SecurityContext): Promise<void> {
    await this.logSecurityEvent(req, context, 'blocked_request', 'IP address is blocked');

    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'IP_BLOCKED',
      requestId: context.requestId
    });
  }

  private async handleOversizedRequest(req: Request, res: Response, context: SecurityContext): Promise<void> {
    await this.logSecurityEvent(req, context, 'oversized_request', 'Request size exceeds limit');

    res.status(413).json({
      success: false,
      error: 'Request entity too large',
      code: 'REQUEST_TOO_LARGE',
      maxSize: this.config.maxRequestSize,
      requestId: context.requestId
    });
  }

  private async handleInvalidAPIKey(req: Request, res: Response, context: SecurityContext, error: string): Promise<void> {
    await this.logSecurityEvent(req, context, 'invalid_api_key', error);

    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      details: error,
      code: 'INVALID_API_KEY',
      requestId: context.requestId
    });
  }

  private async handleNonWhitelistedIP(req: Request, res: Response, context: SecurityContext): Promise<void> {
    await this.logSecurityEvent(req, context, 'non_whitelisted_ip', 'IP not in whitelist');

    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'IP_NOT_WHITELISTED',
      requestId: context.requestId
    });
  }

  private async handleRateLimitExceeded(req: Request, res: Response, context: SecurityContext, rateLimitResult: any): Promise<void> {
    await this.logSecurityEvent(req, context, 'rate_limit_exceeded', 'Rate limit exceeded');

    res.set({
      'X-RateLimit-Remaining': rateLimitResult.remaining || 0,
      'X-RateLimit-Reset': rateLimitResult.resetTime?.getTime() || 0
    });

    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: rateLimitResult.resetTime ? Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000) : 60,
      requestId: context.requestId
    });
  }

  private async logSecurityEvent(req: Request, context: SecurityContext, eventType: string, description: string): Promise<void> {
    try {
      await securityMonitor.recordSecurityEvent({
        type: SecurityEventType.UNAUTHORIZED_API_ACCESS,
        severity: SecuritySeverity.MEDIUM,
        userId: context.userId,
        sessionId: context.sessionId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        timestamp: context.timestamp,
        details: {
          eventType,
          description,
          endpoint: context.endpoint,
          method: context.method,
          requestId: context.requestId
        },
        resolved: false
      });

    } catch (error) {
      logger.error('Failed to log security event', {
        error: (error as Error).message,
        eventType
      });
    }
  }

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  private extractAPIKey(req: Request): string | undefined {
    return (
      req.get('X-API-Key') ||
      req.get('Authorization')?.replace(/^Bearer\s+/i, '') ||
      req.query.api_key as string
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateAPIKey(): string {
    return `clk_${Date.now()}_${Math.random().toString(36).substr(2, 24)}`;
  }

  private async initializeSecurityData(): Promise<void> {
    try {
      // Load blocked IPs
      const blockedIPKeys = await this.redis.keys('blocked_ip:*');
      for (const key of blockedIPKeys) {
        const ip = key.replace('blocked_ip:', '');
        this.blockedIPs.add(ip);
      }

      logger.info('API security initialized', {
        blockedIPs: this.blockedIPs.size,
        sensitiveEndpoints: this.config.sensitiveEndpoints.length,
        publicEndpoints: this.config.publicEndpoints.length
      });

    } catch (error) {
      logger.error('Failed to initialize security data', {
        error: (error as Error).message
      });
    }
  }

  private startIPMonitoring(): void {
    setInterval(async () => {
      try {
        // Clean up old rapid request data
        const keys = await this.redis.keys('rapid_requests:*');
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) { // No expiry set
            await this.redis.expire(key, 3600); // Set 1 hour expiry
          }
        }

      } catch (error) {
        logger.error('IP monitoring cleanup failed', {
          error: (error as Error).message
        });
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }
}

// Export singleton instance
export const apiSecurity = new APISecurity(new Redis(process.env.REDIS_URL || 'redis://localhost:6379'));

// Export convenience functions
export const apiSecurityMiddleware = () => apiSecurity.apiSecurity();
export const sensitiveEndpointProtection = () => apiSecurity.sensitiveEndpointProtection();