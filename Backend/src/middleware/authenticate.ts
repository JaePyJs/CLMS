import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/authService';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: TokenPayload;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Authentication failed: no authorization header', { ip: req.ip });
      res.status(401).json({
        message: 'Authorization header is required',
        code: 'MISSING_AUTHORIZATION_HEADER',
      });
      return;
    }

    const [bearer, token] = authHeader.split(' ');
    
    if (bearer !== 'Bearer' || !token) {
      logger.warn('Authentication failed: invalid authorization format', { ip: req.ip });
      res.status(401).json({
        message: 'Authorization header must be in format: Bearer <token>',
        code: 'INVALID_AUTHORIZATION_FORMAT',
      });
      return;
    }

    try {
      const decoded = AuthService.verifyToken(token);
      req.user = decoded;
      
      logger.debug('Authentication successful', { 
        userId: decoded.userId, 
        username: decoded.username,
        role: decoded.role,
        ip: req.ip 
      });
      
      next();
    } catch (error) {
      logger.warn('Authentication failed: invalid token', { 
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      res.status(401).json({
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error', { 
      ip: req.ip,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    res.status(500).json({
      message: 'Internal authentication error',
      code: 'AUTH_INTERNAL_ERROR',
    });
  }
}

export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        logger.warn('Role check failed: user not authenticated', { ip: req.ip });
        res.status(401).json({
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        logger.warn('Role check failed: insufficient permissions', { 
          userId: req.user.userId,
          username: req.user.username,
          userRole,
          requiredRoles: allowedRoles,
          ip: req.ip 
        });
        
        res.status(403).json({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: allowedRoles,
          current: userRole,
        });
        return;
      }

      logger.debug('Role check successful', { 
        userId: req.user.userId,
        username: req.user.username,
        role: userRole,
        ip: req.ip 
      });
      
      next();
    } catch (error) {
      logger.error('Role middleware error', { 
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      res.status(500).json({
        message: 'Internal authorization error',
        code: 'AUTHZ_INTERNAL_ERROR',
      });
    }
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.debug('Optional authentication: no token provided', { ip: req.ip });
      next();
      return;
    }

    const [bearer, token] = authHeader.split(' ');
    
    if (bearer !== 'Bearer' || !token) {
      logger.debug('Optional authentication: invalid format', { ip: req.ip });
      next();
      return;
    }

    try {
      const decoded = AuthService.verifyToken(token);
      req.user = decoded;
      logger.debug('Optional authentication: token verified', { 
        userId: decoded.userId, 
        username: decoded.username,
        role: decoded.role,
        ip: req.ip 
      });
    } catch (error) {
      logger.debug('Optional authentication: invalid token, continuing without auth', { 
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Don't attach user if token is invalid, but continue processing
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication middleware error', { 
      ip: req.ip,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    // Continue processing even if optional auth fails
    next();
  }
}