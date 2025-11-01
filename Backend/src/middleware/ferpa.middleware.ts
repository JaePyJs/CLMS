import { Request, Response, NextFunction } from 'express';
import { FERPAService } from '../services/ferpaService';
import { ferpaComplianceService } from '../services/ferpaComplianceService';
import { logger } from '../utils/logger';

// Extend Request interface to include FERPA compliance data
declare global {
  namespace Express {
    interface Request {
      ferpaContext?: {
        accessGranted: boolean;
        maskedFields: string[];
        dataCategories: string[];
        accessLevel: string;
        requestId?: string;
        expiresAt?: Date;
      };
      studentId?: string;
      dataCategories?: string[];
      ferpaPurpose?: string;
    }
  }
}

/**
 * FERPA Compliance Middleware
 *
 * This middleware enforces FERPA compliance for all student data access.
 * It must be used after authentication middleware to ensure the user is authenticated.
 */

/**
 * Middleware to check FERPA compliance for student data access
 */
export const ferpaComplianceCheck = (
  dataCategories: string[] = ['PERSONAL'],
  accessLevel: string = 'READ_ONLY',
  options: {
    requirePurpose?: boolean;
    allowSelfAccess?: boolean;
    emergencyBypass?: boolean;
  } = {}
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required for FERPA compliance check',
          code: 'FERPA_AUTH_REQUIRED'
        });
        return;
      }

      // Extract student ID from request parameters, query, or body
      const studentId = req.params.studentId || req.query.studentId as string || req.body.studentId;
      if (!studentId) {
        res.status(400).json({
          success: false,
          message: 'Student ID is required for FERPA compliance check',
          code: 'FERPA_STUDENT_ID_REQUIRED'
        });
        return;
      }

      // Check if user is accessing their own data (if allowed)
      if (options.allowSelfAccess && req.user.id === studentId) {
        req.ferpaContext = {
          accessGranted: true,
          maskedFields: [],
          dataCategories: ['SELF'],
          accessLevel: 'SELF_ACCESS'
        };
        next();
        return;
      }

      // Emergency bypass for critical situations
      if (options.emergencyBypass && req.user.role === 'SUPER_ADMIN') {
        logger.warn('Emergency FERPA bypass used', {
          userId: req.user.id,
          studentId,
          userRole: req.user.role,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        req.ferpaContext = {
          accessGranted: true,
          maskedFields: [],
          dataCategories: ['EMERGENCY'],
          accessLevel: 'EMERGENCY_ACCESS'
        };
        next();
        return;
      }

      // Check for required purpose statement
      if (options.requirePurpose && !req.ferpaPurpose) {
        const purpose = req.headers['x-ferpa-purpose'] as string ||
                       req.body.purpose ||
                       req.query.purpose as string;

        if (!purpose) {
          res.status(400).json({
            success: false,
            message: 'FERPA purpose statement is required for this request',
            code: 'FERPA_PURPOSE_REQUIRED'
          });
          return;
        }

        req.ferpaPurpose = purpose;
      }

      // Perform FERPA compliance check
      const accessResult = await ferpaComplianceService.checkStudentDataAccess(
        studentId,
        req.user.id,
        dataCategories,
        accessLevel,
        {
          sessionId: req.headers['x-session-id'] as string || req.user.id,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          requestId: req.headers['x-request-id'] as string || `ferpa-${Date.now()}`
        }
      );

      // Store FERPA context in request
      req.ferpaContext = {
        accessGranted: accessResult.granted,
        maskedFields: accessResult.maskedFields || [],
        dataCategories,
        accessLevel,
        requestId: req.headers['x-request-id'] as string || `ferpa-${Date.now()}`,
        ...(accessResult.expiresAt && { expiresAt: accessResult.expiresAt })
      };

      req.studentId = studentId;
      req.dataCategories = dataCategories;

      if (!accessResult.granted) {
        res.status(403).json({
          success: false,
          message: 'FERPA compliance check failed',
          code: 'FERPA_ACCESS_DENIED',
          reason: accessResult.reason,
          dataCategories,
          accessLevel
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('FERPA compliance middleware error', {
        error: (error as Error).message,
        userId: req.user?.id,
        studentId: req.params.studentId || req.query.studentId,
        dataCategories
      });

      res.status(500).json({
        success: false,
        message: 'FERPA compliance check failed due to system error',
        code: 'FERPA_SYSTEM_ERROR'
      });
    }
  };
};

/**
 * Middleware to apply data masking based on FERPA context
 */
export const ferpaDataMasking = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Only apply masking if FERPA context exists and access was granted
    if (req.ferpaContext && req.ferpaContext.accessGranted && req.studentId) {
      // Override res.json to apply data masking
      const originalJson = res.json;

      res.json = function(data: any) {
        // Only mask if data contains student information and masking is needed
        if (data && req.ferpaContext?.maskedFields && req.ferpaContext.maskedFields.length > 0) {
          // Apply masking to the response data
          const maskedData = ferpaComplianceService.applyDataMasking(
            data,
            req.studentId!,
            req.user!.role,
            req.ferpaContext.dataCategories
          );

          return originalJson.call(this, maskedData);
        }

        return originalJson.call(this, data);
      };
    }

    next();

  } catch (error) {
    logger.error('FERPA data masking middleware error', {
      error: (error as Error).message,
      userId: req.user?.id
    });

    // Continue without masking on error
    next();
  }
};

/**
 * Middleware to validate FERPA consent requirements
 */
export const ferpaConsentCheck = (requiredConsents: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.studentId) {
        res.status(401).json({
          success: false,
          message: 'Authentication and student ID required for consent check',
          code: 'FERPA_CONSENT_AUTH_REQUIRED'
        });
        return;
      }

      // Check each required consent
      for (const consentType of requiredConsents) {
        const consentResult = await ferpaComplianceService.checkConsentRequirements(
          req.studentId,
          consentType,
          req.user.role
        );

        if (consentResult.required && !consentResult.validConsent) {
          res.status(403).json({
            success: false,
            message: 'FERPA consent requirement not met',
            code: 'FERPA_CONSENT_MISSING',
            consentType: consentResult.consentType,
            guardianConsent: consentResult.guardianConsent
          });
          return;
        }
      }

      next();

    } catch (error) {
      logger.error('FERPA consent check middleware error', {
        error: (error as Error).message,
        userId: req.user?.id,
        studentId: req.studentId,
        requiredConsents
      });

      res.status(500).json({
        success: false,
        message: 'FERPA consent check failed due to system error',
        code: 'FERPA_CONSENT_SYSTEM_ERROR'
      });
    }
  };
};

/**
 * Middleware to log FERPA compliance events
 */
export const ferpaAuditLog = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Store original res.json to intercept response
      const originalJson = res.json;

      res.json = function(data: any) {
        // Log the access attempt after response is sent
        setImmediate(async () => {
          try {
            if (req.user && req.studentId) {
              await ferpaComplianceService.logDataAccess({
                studentId: req.studentId!,
                userId: req.user.id,
                requestId: req.headers['x-request-id'] as string,
                accessType: action,
                dataCategory: req.dataCategories?.join(',') || 'UNKNOWN',
                accessLevel: req.ferpaContext?.accessLevel || 'UNKNOWN',
                accessGranted: res.statusCode < 400,
                recordsCount: Array.isArray(data) ? data.length : (data ? 1 : 0),
                accessPurpose: req.ferpaPurpose || 'UNSPECIFIED',
                sessionId: req.headers['x-session-id'] as string || req.user.id,
                ipAddress: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                ...(res.statusCode >= 400 && { denialReason: 'Request failed' }),
                ...(req.ferpaContext?.expiresAt && { retentionExpiresAt: req.ferpaContext.expiresAt })
              });
            }
          } catch (logError) {
            logger.error('Error in FERPA audit logging', {
              error: (logError as Error).message,
              action,
              userId: req.user?.id
            });
          }
        });

        return originalJson.call(this, data);
      };

      next();

    } catch (error) {
      logger.error('FERPA audit log middleware error', {
        error: (error as Error).message,
        action,
        userId: req.user?.id
      });

      // Continue without logging on error
      next();
    }
  };
};

/**
 * Middleware to validate data access request
 */
export const ferpaAccessRequestValidation = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { purpose, dataCategories, accessLevel, urgencyLevel } = req.body;

    // Validate required fields
    if (!purpose || typeof purpose !== 'string' || purpose.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Purpose is required and must be a non-empty string',
        code: 'FERPA_PURPOSE_INVALID'
      });
      return;
    }

    if (!dataCategories || !Array.isArray(dataCategories) || dataCategories.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Data categories are required and must be a non-empty array',
        code: 'FERPA_DATA_CATEGORIES_INVALID'
      });
      return;
    }

    // Validate data categories
    const validCategories = ['PERSONAL', 'ACADEMIC', 'ACTIVITY', 'MEDICAL', 'FINANCIAL', 'CONTACT', 'PERFORMANCE'];
    const invalidCategories = dataCategories.filter(cat => !validCategories.includes(cat));

    if (invalidCategories.length > 0) {
      res.status(400).json({
        success: false,
        message: `Invalid data categories: ${invalidCategories.join(', ')}`,
        code: 'FERPA_DATA_CATEGORIES_INVALID',
        validCategories
      });
      return;
    }

    // Validate access level
    const validAccessLevels = ['READ_ONLY', 'SUMMARY', 'DETAILED', 'ANALYTICAL'];
    if (accessLevel && !validAccessLevels.includes(accessLevel)) {
      res.status(400).json({
        success: false,
        message: `Invalid access level: ${accessLevel}`,
        code: 'FERPA_ACCESS_LEVEL_INVALID',
        validAccessLevels
      });
      return;
    }

    // Validate urgency level
    const validUrgencyLevels = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY'];
    if (urgencyLevel && !validUrgencyLevels.includes(urgencyLevel)) {
      res.status(400).json({
        success: false,
        message: `Invalid urgency level: ${urgencyLevel}`,
        code: 'FERPA_URGENCY_LEVEL_INVALID',
        validUrgencyLevels
      });
      return;
    }

    // Store validated data in request
    req.ferpaPurpose = purpose.trim();
    req.dataCategories = dataCategories;

    next();

  } catch (error) {
    logger.error('FERPA access request validation error', {
      error: (error as Error).message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'FERPA access request validation failed',
      code: 'FERPA_VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to check minimum user role for FERPA operations
 */
export const ferpaRoleCheck = (minRole: string) => {
  const roleHierarchy: Record<string, number> = {
    'SUPER_ADMIN': 6,
    'ADMIN': 5,
    'LIBRARIAN': 4,
    'ASSISTANT': 3,
    'TEACHER': 2,
    'VIEWER': 1
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'FERPA_AUTH_REQUIRED'
        });
        return;
      }

      const userRoleLevel = roleHierarchy[req.user.role] || 0;
      const requiredRoleLevel = roleHierarchy[minRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        res.status(403).json({
          success: false,
          message: `Insufficient role privileges. Required: ${minRole}, User role: ${req.user.role}`,
          code: 'FERPA_ROLE_INSUFFICIENT'
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('FERPA role check error', {
        error: (error as Error).message,
        userId: req.user?.id,
        requiredRole: minRole
      });

      res.status(500).json({
        success: false,
        message: 'FERPA role check failed',
        code: 'FERPA_ROLE_CHECK_ERROR'
      });
    }
  };
};

/**
 * Composite middleware for comprehensive FERPA compliance
 */
export const ferpaProtection = (
  dataCategories: string[] = ['PERSONAL'],
  accessLevel: string = 'READ_ONLY',
  options: {
    requirePurpose?: boolean;
    allowSelfAccess?: boolean;
    emergencyBypass?: boolean;
    minRole?: string;
    auditAction?: string;
  } = {}
) => {
  const middlewares = [];

  // Add role check if specified
  if (options.minRole) {
    middlewares.push(ferpaRoleCheck(options.minRole));
  }

  // Add FERPA compliance check
  middlewares.push(ferpaComplianceCheck(dataCategories, accessLevel, options));

  // Add data masking
  middlewares.push(ferpaDataMasking);

  // Add audit logging
  middlewares.push(ferpaAuditLog(options.auditAction || 'DATA_ACCESS'));

  return middlewares;
};

// Export commonly used middleware combinations
export const ferpaStudentReadProtection = ferpaProtection(['PERSONAL', 'ACADEMIC'], 'READ_ONLY', {
  requirePurpose: true,
  auditAction: 'STUDENT_READ'
});

export const ferpaStudentWriteProtection = ferpaProtection(['PERSONAL', 'ACADEMIC'], 'MODIFY', {
  requirePurpose: true,
  minRole: 'LIBRARIAN',
  auditAction: 'STUDENT_MODIFY'
});

export const ferpaAnalyticsProtection = ferpaProtection(['ACTIVITY', 'PERFORMANCE'], 'ANALYTICAL', {
  requirePurpose: true,
  minRole: 'ADMIN',
  auditAction: 'ANALYTICS_ACCESS'
});

export const ferpaEmergencyAccess = ferpaProtection(['PERSONAL', 'ACADEMIC', 'MEDICAL'], 'READ_ONLY', {
  emergencyBypass: true,
  minRole: 'SUPER_ADMIN',
  auditAction: 'EMERGENCY_ACCESS'
});

// Audit middleware for tracking operations
export const auditMiddleware = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Log the audit action
      logger.info('Audit log', {
        action,
        userId: req.user?.id,
        userRole: req.user?.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string
      });

      next();
    } catch (error) {
      logger.error('Audit middleware error', {
        error: (error as Error).message,
        action,
        userId: req.user?.id
      });
      next();
    }
  };
};

// Legacy exports for backward compatibility
export const ferpaAccessCheck = ferpaComplianceCheck;
export const parentalConsentCheck = ferpaConsentCheck(['PERSONAL_INFO']);
