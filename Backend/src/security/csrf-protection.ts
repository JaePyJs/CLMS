import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '@/utils/logger';

export interface CSRFConfig {
  tokenLength: number;
  tokenExpiry: number;
  cookieName: string;
  headerName: string;
  secureCookie: boolean;
  sameSiteCookie: 'strict' | 'lax' | 'none';
  ignoreMethods: string[];
  ignorePaths: RegExp[];
}

export class CSRFProtection {
  private config: CSRFConfig;
  private tokenStore: Map<string, { token: string; expires: number }> = new Map();

  constructor(config: Partial<CSRFConfig> = {}) {
    this.config = {
      tokenLength: 32,
      tokenExpiry: 3600 * 1000, // 1 hour
      cookieName: '_csrf',
      headerName: 'x-csrf-token',
      secureCookie: process.env.NODE_ENV === 'production',
      sameSiteCookie: 'strict',
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
      ignorePaths: [
        /^\/api\/auth\/login/,
        /^\/api\/auth\/logout/,
        /^\/api\/health/,
        /^\/api\/docs/,
        /^\/webhook\//
      ],
      ...config
    };

    // Clean up expired tokens every 5 minutes
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 5 * 60 * 1000);
  }

  generateToken(): string {
    return crypto.randomBytes(this.config.tokenLength).toString('hex');
  }

  private generateSessionToken(sessionId: string): string {
    const timestamp = Date.now();
    const data = `${sessionId}:${timestamp}`;
    return crypto.createHmac('sha256', process.env.JWT_SECRET || 'default-secret')
      .update(data)
      .digest('hex');
  }

  private isTokenValid(sessionId: string, providedToken: string): boolean {
    const storedData = this.tokenStore.get(sessionId);
    if (!storedData) {
      return false;
    }

    // Check if token has expired
    if (Date.now() > storedData.expires) {
      this.tokenStore.delete(sessionId);
      return false;
    }

    // Verify token
    const expectedToken = storedData.token;
    return crypto.timingSafeEqual(
      Buffer.from(providedToken, 'hex'),
      Buffer.from(expectedToken, 'hex')
    );
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokenStore.entries()) {
      if (now > data.expires) {
        this.tokenStore.delete(sessionId);
      }
    }
  }

  // Middleware to generate and set CSRF token
  generateCSRFToken() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Skip CSRF token generation for ignored methods and paths
        if (this.config.ignoreMethods.includes(req.method) ||
            this.config.ignorePaths.some(path => path.test(req.path))) {
          next();
          return;
        }

        // Get session ID from request
        const sessionId = this.getSessionId(req);
        if (!sessionId) {
          // If no session, we can't set a CSRF token
          next();
          return;
        }

        // Generate new CSRF token
        const token = this.generateToken();
        const expires = Date.now() + this.config.tokenExpiry;

        // Store token
        this.tokenStore.set(sessionId, { token, expires });

        // Set CSRF cookie
        res.cookie(this.config.cookieName, token, {
          httpOnly: false, // Allow JavaScript to read the token
          secure: this.config.secureCookie,
          sameSite: this.config.sameSiteCookie,
          maxAge: this.config.tokenExpiry,
          path: '/'
        });

        // Add token to response headers for API clients
        res.set({
          'X-CSRF-Token': token,
          'X-CSRF-Expiry': expires.toString()
        });

        next();
      } catch (error) {
        logger.error('CSRF token generation error', {
          error: (error as Error).message,
          sessionId: this.getSessionId(req)
        });
        next();
      }
    };
  }

  // Middleware to validate CSRF token
  validateCSRFToken() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Skip CSRF validation for ignored methods and paths
        if (this.config.ignoreMethods.includes(req.method) ||
            this.config.ignorePaths.some(path => path.test(req.path))) {
          next();
          return;
        }

        // Get session ID from request
        const sessionId = this.getSessionId(req);
        if (!sessionId) {
          res.status(401).json({
            success: false,
            error: 'Session required for CSRF protection'
          });
          return;
        }

        // Get CSRF token from request
        const tokenFromHeader = req.get(this.config.headerName);
        const tokenFromBody = req.body?.['_csrf'];
        const providedToken = tokenFromHeader || tokenFromBody;

        if (!providedToken) {
          logger.warn('CSRF token missing', {
            sessionId: sessionId.substring(0, 8) + '...',
            method: req.method,
            path: req.path,
            ip: req.ip
          });

          res.status(403).json({
            success: false,
            error: 'CSRF token required',
            code: 'CSRF_TOKEN_MISSING'
          });
          return;
        }

        // Validate token
        if (!this.isTokenValid(sessionId, providedToken)) {
          logger.warn('Invalid CSRF token', {
            sessionId: sessionId.substring(0, 8) + '...',
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          // Remove the invalid token
          this.tokenStore.delete(sessionId);

          res.status(403).json({
            success: false,
            error: 'Invalid or expired CSRF token',
            code: 'CSRF_TOKEN_INVALID'
          });
          return;
        }

        // Token is valid, proceed
        next();
      } catch (error) {
        logger.error('CSRF validation error', {
          error: (error as Error).message,
          sessionId: this.getSessionId(req)
        });

        res.status(500).json({
          success: false,
          error: 'CSRF validation error'
        });
      }
    };
  }

  // Combined middleware that both generates and validates
  csrfProtection() {
    return [this.generateCSRFToken(), this.validateCSRFToken()];
  }

  // Get current CSRF token for a session
  getTokenForSession(sessionId: string): string | null {
    const storedData = this.tokenStore.get(sessionId);
    if (!storedData || Date.now() > storedData.expires) {
      return null;
    }
    return storedData.token;
  }

  // Invalidate CSRF token for a session
  invalidateToken(sessionId: string): void {
    this.tokenStore.delete(sessionId);
  }

  // Get CSRF statistics
  getStats(): {
    activeTokens: number;
    expiredTokens: number;
    config: CSRFConfig;
  } {
    const now = Date.now();
    let activeTokens = 0;
    let expiredTokens = 0;

    for (const [sessionId, data] of this.tokenStore.entries()) {
      if (now > data.expires) {
        expiredTokens++;
      } else {
        activeTokens++;
      }
    }

    return {
      activeTokens,
      expiredTokens,
      config: this.config
    };
  }

  // Refresh CSRF token for a session
  refreshToken(sessionId: string): string | null {
    const token = this.generateToken();
    const expires = Date.now() + this.config.tokenExpiry;

    this.tokenStore.set(sessionId, { token, expires });
    return token;
  }

  // Validate token from request without middleware
  validateRequest(req: Request): boolean {
    const sessionId = this.getSessionId(req);
    if (!sessionId) {
      return false;
    }

    if (this.config.ignoreMethods.includes(req.method) ||
        this.config.ignorePaths.some(path => path.test(req.path))) {
      return true;
    }

    const tokenFromHeader = req.get(this.config.headerName);
    const tokenFromBody = req.body?.['_csrf'];
    const providedToken = tokenFromHeader || tokenFromBody;

    if (!providedToken) {
      return false;
    }

    return this.isTokenValid(sessionId, providedToken);
  }

  private getSessionId(req: Request): string | null {
    // Try to get session ID from various sources
    // Priority: Authorization token -> Session cookie -> Custom header

    // From Authorization header (JWT)
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // Simple session ID extraction from JWT token (you might want to use a proper JWT library)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          return payload.sessionId || payload.userId;
        }
      } catch (error) {
        // Invalid JWT, continue to other methods
      }
    }

    // From session cookie
    const sessionCookie = req.cookies?.['sessionId'] || req.cookies?.['connect.sid'];
    if (sessionCookie) {
      return sessionCookie;
    }

    // From custom header
    const sessionHeader = req.get('X-Session-ID');
    if (sessionHeader) {
      return sessionHeader;
    }

    return null;
  }

  // Middleware to add CSRF token to response for SPA applications
  addCSRFToResponse() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Add CSRF token to response for GET requests to enable frontend token setup
      if (req.method === 'GET') {
        const sessionId = this.getSessionId(req);
        if (sessionId) {
          let token = this.getTokenForSession(sessionId);

          // Generate new token if none exists or expired
          if (!token) {
            token = this.refreshToken(sessionId);
          }

          if (token) {
            // Add to response headers
            res.set('X-CSRF-Token', token);

            // Add to locals for template rendering
            res.locals.csrfToken = token;
          }
        }
      }

      next();
    };
  }
}

// Export singleton instance
export const csrfProtection = new CSRFProtection();

// Export convenience functions
export const generateCSRFToken = () => csrfProtection.generateCSRFToken();
export const validateCSRFToken = () => csrfProtection.validateCSRFToken();
export const csrfMiddleware = () => csrfProtection.csrfProtection();
export const addCSRFToResponse = () => csrfProtection.addCSRFToResponse();