import { Request, Response, NextFunction } from 'express'
import { authService, JWTPayload } from '@/services/authService'
import { logger } from '@/utils/logger'

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      })
      return
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token
    const decoded = authService.verifyToken(token)
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid token.'
      })
      return
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