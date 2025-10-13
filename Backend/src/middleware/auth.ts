import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authService, JWTPayload } from '@/services/authService'
import { enhancedAuthService } from '@/services/enhancedAuthService'
import { logger } from '@/utils/logger'

// Extend JWTPayload with sessionId
export interface EnhancedJWTPayload extends JWTPayload {
  sessionId?: string
  sub?: string
  iss?: string
  aud?: string
}

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: EnhancedJWTPayload
    }
  }
}

// Enhanced authentication middleware with cookie support and JWT claims validation
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined

    // Priority 1: Try to get token from HttpOnly cookie (preferred for web apps)
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken
    }

    // Priority 2: Try to get token from Authorization header (for mobile apps/API clients)
    if (!token) {
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7) // Remove 'Bearer ' prefix
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      })
      return
    }

    // Verify token with enhanced JWT claims validation
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key'
    const expectedIssuer = process.env.JWT_ISSUER || 'clms-api'
    const expectedAudience = process.env.JWT_AUDIENCE || 'clms-frontend'

    let decoded: EnhancedJWTPayload

    try {
      decoded = jwt.verify(token, jwtSecret, {
        issuer: expectedIssuer,
        audience: expectedAudience,
        algorithms: ['HS256']
      }) as EnhancedJWTPayload
    } catch (jwtError) {
      const error = jwtError as jwt.JsonWebTokenError
      
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          message: 'Token expired. Please refresh your token.',
          code: 'TOKEN_EXPIRED'
        })
        return
      }

      logger.warn('Invalid JWT token', { 
        error: error.message,
        name: error.name 
      })

      res.status(401).json({
        success: false,
        message: 'Invalid token.'
      })
      return
    }

    // Check if session is still valid (not revoked)
    if (decoded.sessionId) {
      const isValid = await enhancedAuthService.validateSession(decoded.sessionId)
      if (!isValid) {
        res.status(401).json({
          success: false,
          message: 'Session has been revoked. Please login again.',
          code: 'SESSION_REVOKED'
        })
        return
      }
    }

    // Add user to request
    req.user = decoded
    next()
  } catch (error) {
    logger.error('Authentication error', { error: (error as Error).message })
    res.status(500).json({
      success: false,
      message: 'An error occurred during authentication.'
    })
  }
}

// Role-based authorization middleware
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      })
      return
    }

    next()
  }
}

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next()
      return
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token
    const decoded = authService.verifyToken(token)
    if (decoded) {
      // Add user to request
      req.user = decoded
    }

    next()
  } catch (error) {
    logger.error('Optional authentication error', { error: (error as Error).message })
    // Continue without authentication
    next()
  }
}

// Admin role authorization middleware
export const requireAdmin = authorize(['ADMIN'])

// Librarian role authorization middleware
export const requireLibrarian = authorize(['ADMIN', 'LIBRARIAN'])

// Staff role authorization middleware
export const requireStaff = authorize(['ADMIN', 'LIBRARIAN', 'STAFF'])

// Export authenticate as authMiddleware for compatibility
export const authMiddleware = authenticate