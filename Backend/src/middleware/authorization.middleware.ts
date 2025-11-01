import { Request, Response, NextFunction } from 'express';
import { users_role as UserRole } from '@prisma/client';
import {
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../config/permissions';
import { EnhancedJWTPayload } from './auth';

// Extend Express Request type to include user with permissions
declare global {
  namespace Express {
    interface Request {
      user?: EnhancedJWTPayload;
    }
  }
}

/**
 * Middleware to check if user has a specific permission
 */
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userHasPermission = hasPermission(
      req.user.role as UserRole,
      permission,
      req.user.permissions,
    );

    if (!userHasPermission) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: permission,
        userRole: req.user.role,
      });
      return;
    }

    return next();
  };
};

/**
 * Middleware to check if user has ANY of the specified permissions
 */
export const requireAnyPermission = (permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userHasPermission = hasAnyPermission(
      req.user.role as UserRole,
      permissions,
      req.user.permissions,
    );

    if (!userHasPermission) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredAny: permissions,
        userRole: req.user.role,
      });
      return;
    }

    return next();
  };
};

/**
 * Middleware to check if user has ALL of the specified permissions
 */
export const requireAllPermissions = (permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userHasPermissions = hasAllPermissions(
      req.user.role as UserRole,
      permissions,
      req.user.permissions,
    );

    if (!userHasPermissions) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredAll: permissions,
        userRole: req.user.role,
      });
      return;
    }

    return next();
  };
};

/**
 * Middleware to check if user has a specific role
 */
export const requireRole = (roles: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient role privileges',
        required: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    return next();
  };
};

/**
 * Middleware to check if user is admin or super admin
 */
export const requireAdmin = requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

/**
 * Middleware to check if user is super admin
 */
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

/**
 * Helper to check permissions in route handlers
 */
export const checkPermission = (
  req: Request,
  permission: Permission,
): boolean => {
  if (!req.user) return false;

  return hasPermission(req.user.role as UserRole, permission, req.user.permissions);
};

/**
 * Middleware to allow access only to own resources or if admin
 */
export const requireOwnershipOrAdmin = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];
    const isOwner = req.user.id === targetUserId;
    const isAdmin = req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'You can only access your own resources',
      });
      return;
    }

    return next();
  };
};

/**
 * Middleware factory for resource-specific permission checks
 */
export const resourcePermission = (
  resource: string,
  action: 'view' | 'create' | 'update' | 'delete',
) => {
  const permission = `${resource}:${action}` as Permission;
  return requirePermission(permission);
};
